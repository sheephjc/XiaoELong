import type { GomokuGame, ServerToClientEvents, ClientToServerEvents } from "@xiaoelong/shared";
import type { Server } from "socket.io";

export function emitGomokuUpdate(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  game: GomokuGame
): void {
  const audienceRooms = [
    `user:${game.playerBlack.id}`,
    `user:${game.playerWhite.id}`,
    `gomoku:${game.id}`
  ];
  io.to(audienceRooms).emit("gomoku:update", { game });
  if (game.status === "finished") {
    io.to(audienceRooms).emit("gomoku:end", { game, winner: game.winner });
  }
}
