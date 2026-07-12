import type {
  ClientToServerEvents,
  GomokuAcceptPayload,
  GomokuInvitePayload,
  GomokuMovePayload,
  GomokuRejectPayload,
  PresenceUser,
  ServerToClientEvents
} from "@xiaoelong/shared";
import type { Server, Socket } from "socket.io";
import { listDailyMoodsByUserId } from "../db/daily-moods.js";
import { createMessage } from "../db/messages.js";
import { listUsers, getUserById } from "../db/users.js";
import { GomokuService, GomokuValidationError } from "../services/gomoku-service.js";
import { normalizeChatContent, normalizeChatFile, normalizeChatImage } from "../utils/chat.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { emitGomokuUpdate } from "./gomoku-events.js";

const MAIN_ROOM = "room:main";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

interface SocketData {
  userId: string;
}

const socketIdsByUserId = new Map<string, Set<string>>();

interface SocketSetupDependencies {
  gomokuService: GomokuService;
}

function getOnlineUserIds(): string[] {
  return Array.from(socketIdsByUserId.entries())
    .filter((entry) => entry[1].size > 0)
    .map((entry) => entry[0]);
}

function addOnlineSocket(userId: string, socketId: string): boolean {
  const existing = socketIdsByUserId.get(userId);
  if (existing) {
    existing.add(socketId);
    return false;
  }

  socketIdsByUserId.set(userId, new Set([socketId]));
  return true;
}

function removeOnlineSocket(userId: string, socketId: string): boolean {
  const existing = socketIdsByUserId.get(userId);
  if (!existing) {
    return false;
  }

  existing.delete(socketId);
  if (existing.size > 0) {
    return false;
  }

  socketIdsByUserId.delete(userId);
  return true;
}

export async function listPresenceUsers(): Promise<PresenceUser[]> {
  const allUsers = await listUsers();
  const onlineSet = new Set(getOnlineUserIds());
  const moodsByUserId = await listDailyMoodsByUserId();
  return allUsers.map((user) => ({
    ...user,
    isOnline: onlineSet.has(user.id),
    todayMood: moodsByUserId.get(user.id) ?? null
  }));
}

export function setupSocket(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  dependencies: SocketSetupDependencies
): void {
  io.use(async (socket, next) => {
    const rawToken = socket.handshake.auth?.token;
    const token = typeof rawToken === "string" ? rawToken : null;
    if (!token) {
      next(new Error("Unauthorized."));
      return;
    }

    try {
      const claims = verifyAccessToken(token);
      const user = await getUserById(claims.sub);
      if (!user) {
        next(new Error("Unauthorized."));
        return;
      }

      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Unauthorized."));
    }
  });

  io.on("connection", async (socket: AppSocket) => {
    const { userId } = socket.data;
    socket.join(MAIN_ROOM);
    socket.join(`user:${userId}`);

    const isFirstConnection = addOnlineSocket(userId, socket.id);

    try {
      const presenceUsers = await listPresenceUsers();
      const currentUser = presenceUsers.find((user) => user.id === userId);
      socket.emit("presence:init", {
        users: presenceUsers
      });

      if (isFirstConnection) {
        io.to(MAIN_ROOM).emit("presence:online", {
          userId,
          onlineUserIds: getOnlineUserIds(),
          user: currentUser
        });
      }

      const activeGameIds = await dependencies.gomokuService.listActiveGameIdsForUser(userId);
      for (const gameId of activeGameIds) {
        socket.join(`gomoku:${gameId}`);
      }
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.on("chat:send", async (payload, ack) => {
      const imagePayload = payload?.image ?? null;
      const filePayload = payload?.file ?? null;
      if (imagePayload && filePayload) {
        ack?.({
          ok: false,
          error: "Only one attachment is allowed per message."
        });
        return;
      }

      const normalizedImage = imagePayload ? normalizeChatImage(imagePayload) : null;
      if (normalizedImage && !normalizedImage.ok) {
        ack?.({
          ok: false,
          error: normalizedImage.error
        });
        return;
      }

      const image = normalizedImage?.image ?? null;
      const normalizedFile = filePayload ? normalizeChatFile(filePayload) : null;
      if (normalizedFile && !normalizedFile.ok) {
        ack?.({
          ok: false,
          error: normalizedFile.error
        });
        return;
      }

      const file = normalizedFile?.file ?? null;
      const normalized = normalizeChatContent(payload?.content ?? "", {
        allowEmpty: Boolean(image || file)
      });
      if (!normalized.ok) {
        ack?.({
          ok: false,
          error: normalized.error
        });
        return;
      }

      try {
        const message = await createMessage(userId, {
          content: normalized.content,
          image,
          file
        });
        io.to(MAIN_ROOM).emit("chat:message", message);
        ack?.({ ok: true });
      } catch {
        ack?.({
          ok: false,
          error: "Failed to send message."
        });
      }
    });

    socket.on("gomoku:invite", async (payload: GomokuInvitePayload, ack) => {
      try {
        const game = await dependencies.gomokuService.createInvite(userId, payload.targetUserId);
        socket.join(`gomoku:${game.id}`);
        emitGomokuUpdate(io, game);
        ack?.({ ok: true, game });
      } catch (error) {
        if (error instanceof GomokuValidationError) {
          ack?.({ ok: false, error: error.message });
          return;
        }
        ack?.({ ok: false, error: "Failed to create game invite." });
      }
    });

    socket.on("gomoku:accept", async (payload: GomokuAcceptPayload, ack) => {
      try {
        const game = await dependencies.gomokuService.acceptInvite(payload.gameId, userId);
        socket.join(`gomoku:${game.id}`);
        emitGomokuUpdate(io, game);
        ack?.({ ok: true, game });
      } catch (error) {
        if (error instanceof GomokuValidationError) {
          ack?.({ ok: false, error: error.message });
          return;
        }
        ack?.({ ok: false, error: "Failed to accept game invite." });
      }
    });

    socket.on("gomoku:reject", async (payload: GomokuRejectPayload, ack) => {
      try {
        const game = await dependencies.gomokuService.rejectInvite(payload.gameId, userId);
        emitGomokuUpdate(io, game);
        ack?.({ ok: true, game });
      } catch (error) {
        if (error instanceof GomokuValidationError) {
          ack?.({ ok: false, error: error.message });
          return;
        }
        ack?.({ ok: false, error: "Failed to reject game invite." });
      }
    });

    socket.on("gomoku:move", async (payload: GomokuMovePayload, ack) => {
      try {
        const game = await dependencies.gomokuService.makeMove(payload.gameId, userId, payload.row, payload.col);
        emitGomokuUpdate(io, game);
        ack?.({ ok: true, game });
      } catch (error) {
        if (error instanceof GomokuValidationError) {
          ack?.({ ok: false, error: error.message });
          return;
        }
        ack?.({ ok: false, error: "Failed to apply gomoku move." });
      }
    });

    socket.on("disconnect", () => {
      const isNowOffline = removeOnlineSocket(userId, socket.id);
      if (!isNowOffline) {
        return;
      }

      io.to(MAIN_ROOM).emit("presence:offline", {
        userId,
        onlineUserIds: getOnlineUserIds()
      });
    });
  });
}
