import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const environment = {
  ...process.env,
  ELECTRON_START_URL: "http://localhost:5173"
};

delete environment.ELECTRON_RUN_AS_NODE;

const electronProcess = spawn(electronPath, [process.cwd()], {
  env: environment,
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (!electronProcess.killed) {
      electronProcess.kill(signal);
    }
  });
}

electronProcess.once("error", (error) => {
  console.error("[dev-electron] Failed to start Electron.", error);
  process.exitCode = 1;
});

electronProcess.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
