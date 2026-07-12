import http from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@xiaoelong/shared";
import { env } from "./config/env.js";
import { createAuthRouter } from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import { createDailyMoodRouter } from "./routes/daily-mood.js";
import { createDailyQuestionRouter } from "./routes/daily-question.js";
import { createGomokuRouter } from "./routes/gomoku.js";
import { startQuestionScheduler } from "./jobs/question-scheduler.js";
import { DailyQuestionService } from "./services/daily-question-service.js";
import { GomokuService } from "./services/gomoku-service.js";
import { setupSocket } from "./socket/index.js";
import { ensureUploadDirs, uploadRoot } from "./utils/uploads.js";

const app = express();
const server = http.createServer(app);
const corsOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

ensureUploadDirs();
const updateRoot = env.UPDATE_ROOT || path.resolve(process.cwd(), "..", "updates");
mkdirSync(updateRoot, { recursive: true });

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadRoot));
app.use("/updates", express.static(updateRoot, {
  fallthrough: false
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/chat", chatRouter);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

const dailyQuestionService = new DailyQuestionService();
const gomokuService = new GomokuService();

app.use("/api/auth", createAuthRouter(io));
app.use("/api/daily-question", createDailyQuestionRouter(io, dailyQuestionService));
app.use("/api/daily-mood", createDailyMoodRouter(io));
app.use("/api/gomoku", createGomokuRouter(io, gomokuService));

setupSocket(io, { gomokuService });

void dailyQuestionService
  .ensureTodayQuestion()
  .then((question) => {
    console.log(`[DailyQuestion] ensured ${question.date} (${question.sourceType}).`);
  })
  .catch((error) => {
    console.error("[DailyQuestion] startup ensure failed:", error);
  });

startQuestionScheduler(dailyQuestionService);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ message: error.message });
    return;
  }

  if (error instanceof Error) {
    if (
      error.message === "Avatar must be an image file." ||
      error.message === "Chat image must be a jpg, png, webp, or gif file." ||
      error.message === "Chat file type is not allowed."
    ) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error(error.message);
  } else {
    console.error("Unknown server error:", error);
  }

  res.status(500).json({ message: "Internal server error." });
});

server.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
