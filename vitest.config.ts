import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // 测试直接解析 shared 源码，避免依赖构建产物 shared/dist
      "@xiaoelong/shared": path.join(repositoryRoot, "shared/src/index.ts")
    }
  },
  test: {
    include: ["{client,server,shared}/src/**/*.test.{ts,tsx}", "{electron,scripts}/**/*.test.mjs"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./client/src/test-setup.ts"]
  }
});
