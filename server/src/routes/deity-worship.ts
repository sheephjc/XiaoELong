import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import {
  DEITY_CATALOG,
  getDeityRank,
  type ClientToServerEvents,
  type DeityId,
  type DeityWorshipResponse,
  type DeityWorshipUpdatePayload,
  type ServerToClientEvents
} from "@xiaoelong/shared";
import {
  createDeityWorship,
  getCurrentDeityWorshipDay,
  getDeityWorshipForUser,
  isDuplicateDeityWorshipError,
  listDeityStatuses
} from "../db/deity-worships.js";
import { requireAuth } from "../middleware/auth.js";

const deityIds = DEITY_CATALOG.map((deity) => deity.id) as [DeityId, ...DeityId[]];
const worshipSchema = z.object({
  deityId: z.enum(deityIds)
});

export function createDeityWorshipRouter(io: Server<ClientToServerEvents, ServerToClientEvents>): Router {
  const router = Router();

  router.get("/today", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    try {
      const worshipDay = getCurrentDeityWorshipDay();
      const [todayWorship, deities] = await Promise.all([
        getDeityWorshipForUser(req.user.id, worshipDay),
        listDeityStatuses()
      ]);
      res.json({ worshipDay, todayWorship, deities });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAuth, async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = worshipSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid deity worship payload." });
      return;
    }

    try {
      const worshipDay = getCurrentDeityWorshipDay();
      const deityDefinition = DEITY_CATALOG.find((deity) => deity.id === parsed.data.deityId);
      if (!deityDefinition) {
        res.status(400).json({ message: "Unknown deity." });
        return;
      }

      const created = await createDeityWorship(req.user.id, parsed.data.deityId, worshipDay);
      const previousTotal = created.previousTotal;
      const todayWorship = created.worship;
      const deities = await listDeityStatuses();

      const deity = deities.find((item) => item.deityId === parsed.data.deityId);
      if (!deity) {
        throw new Error("Worshipped deity status is missing.");
      }

      const previousRank = getDeityRank(previousTotal);
      const rankAdvanced = getDeityRank(previousTotal + 1) !== previousRank;
      const updatePayload: DeityWorshipUpdatePayload = { deity };
      io.emit("deity:worship", updatePayload);

      const response: DeityWorshipResponse = {
        ok: true,
        worshipDay,
        todayWorship,
        deities,
        blessing: deityDefinition.blessing,
        deity,
        previousRank,
        rankAdvanced
      };
      res.status(201).json(response);
    } catch (error) {
      if (isDuplicateDeityWorshipError(error)) {
        res.status(409).json({ message: "今日已经膜拜过一位神了。" });
        return;
      }
      next(error);
    }
  });

  return router;
}
