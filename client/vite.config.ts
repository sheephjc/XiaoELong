/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // 直接解析 shared 源码，避免依赖构建产物 shared/dist（与根 vitest.config.ts 一致）
      "@xiaoelong/shared": path.join(clientDir, "../shared/src/index.ts")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"]
  }
});
