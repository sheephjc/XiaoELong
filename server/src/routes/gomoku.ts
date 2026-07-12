import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import type { ClientToServerEvents, ServerToClientEvents } from "@xiaoelong/shared";
import { requireAuth } from "../middleware/auth.js";
import { GomokuService, GomokuValidationError } from "../services/gomoku-service.js";
import { emitGomokuUpdate } from "../socket/gomoku-events.js";

const inviteSchema = z.object({
  targetUserId: z.string().trim().min(1)
});

const acceptSchema = z.object({
  gameId: z.coerce.number().int().positive()
});

const rejectSchema = z.object({
  gameId: z.coerce.number().int().positive()
});

const moveSchema = z.object({
  gameId: z.coerce.number().int().positive(),
  row: z.coerce.number().int().min(0).max(14),
  col: z.coerce.number().int().min(0).max(14)
});

export function createGomokuRouter(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  service: GomokuService
): Router {
  const router = Router();

  router.get("/games", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    try {
      const games = await service.listGamesForUser(req.user.id);
      res.json({ games });
    } catch (error) {
      next(error);
    }
  });

  router.post("/invite", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid invite payload." });
      return;
    }

    try {
      const game = await service.createInvite(req.user.id, parsed.data.targetUserId);
      emitGomokuUpdate(io, game);
      res.status(201).json({ game });
    } catch (error) {
      if (error instanceof GomokuValidationError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/accept", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid accept payload." });
      return;
    }

    try {
      const game = await service.acceptInvite(parsed.data.gameId, req.user.id);
      emitGomokuUpdate(io, game);
      res.json({ game });
    } catch (error) {
      if (error instanceof GomokuValidationError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/reject", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid reject payload." });
      return;
    }

    try {
      const game = await service.rejectInvite(parsed.data.gameId, req.user.id);
      emitGomokuUpdate(io, game);
      res.json({ game });
    } catch (error) {
      if (error instanceof GomokuValidationError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/move", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid move payload." });
      return;
    }

    try {
      const game = await service.makeMove(parsed.data.gameId, req.user.id, parsed.data.row, parsed.data.col);
      emitGomokuUpdate(io, game);
      res.json({ game });
    } catch (error) {
      if (error instanceof GomokuValidationError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
