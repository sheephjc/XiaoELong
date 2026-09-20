// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

vi.mock("../config/env.js", () => ({ env: {
  MAX_MESSAGE_LENGTH: 1000, MAX_CHAT_IMAGE_SIZE_MB: 1 / 1024,
  MAX_CHAT_FILE_SIZE_MB: 1 / 1024
} }));
vi.mock("../db/messages.js", () => ({ getRecentMessages: vi.fn() }));
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next()
}));
vi.mock("../utils/uploads.js", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return {
    chatFileDir: await mkdtemp(join(tmpdir(), "xiaoelong-test-files-")),
    chatImageDir: await mkdtemp(join(tmpdir(), "xiaoelong-test-images-"))
  };
});

import router from "./chat.js";
import { chatFileDir, chatImageDir } from "../utils/uploads.js";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use("/chat", router);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ message: error.message });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await Promise.all([chatFileDir, chatImageDir].map(dir => rm(dir, { recursive: true, force: true })));
});

async function upload(route: string, field: string, filename: string, content: string, type: string) {
  const form = new FormData();
  form.set(field, new Blob([content], { type }), filename);
  return fetch(`${base}/chat/${route}`, { method: "POST", body: form });
}

describe("chat uploads after Multer security upgrade", () => {
  it("preserves file contents and existing upload URLs", async () => {
    const response = await upload("files", "file", "notes.txt", "hello", "text/plain");
    expect(response.status).toBe(201);
    const { file } = await response.json();
    expect(file).toMatchObject({ name: "notes.txt", size: 5, mimeType: "text/plain" });
    expect(file.url).toMatch(/^\/uploads\/chat-files\/[^/]+\.txt$/);
    expect(await readFile(path.join(chatFileDir, path.basename(file.url)), "utf8")).toBe("hello");
  });

  it("preserves supported image uploads", async () => {
    const response = await upload("images", "image", "photo.png", "image fixture", "image/png");
    expect(response.status).toBe(201);
    const { image } = await response.json();
    expect(image.url).toMatch(/^\/uploads\/chat-images\/[^/]+\.png$/);
  });

  it("rejects blocked types and oversized files without leaving partial files", async () => {
    const before = await readdir(chatFileDir);
    expect((await upload("files", "file", "blocked.exe", "test", "application/octet-stream")).status).toBe(400);
    expect((await upload("files", "file", "large.txt", "x".repeat(2048), "text/plain")).status).toBe(400);
    expect(await readdir(chatFileDir)).toEqual(before);
    expect((await upload("images", "image", "wrong.txt", "test", "text/plain")).status).toBe(400);
  });

  it("handles truncated multipart input and accepts subsequent valid uploads", async () => {
    const response = await fetch(`${base}/chat/files`, {
      method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test-boundary" },
      body: "--test-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"broken.txt\"\r\n"
    });
    expect(response.status).toBe(400);
    expect((await upload("files", "file", "after.txt", "ok", "text/plain")).status).toBe(201);
  });
});
