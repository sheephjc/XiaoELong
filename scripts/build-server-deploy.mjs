// scripts/build-server-deploy.mjs
// 组装并打包服务器部署包 XiaoELong-server-<version>.zip。
// 依赖：先构建 shared 与 server（根目录 npm run server:deploy 会自动处理）。
// Windows 使用系统自带的 PowerShell/.NET，其他平台使用 zip 命令。
// 产物先写入 deploy/ 下的临时 zip，成功后再替换正式 zip；失败时保留已有正式包。

import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

async function assertBuilt(filePath, hint) {
  let isFile = false;
  try {
    isFile = (await stat(filePath)).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    throw new Error(`${hint}缺失：${filePath}。请先构建 shared 与 server。`);
  }
}

async function assertArchive(filePath) {
  const archiveStat = await stat(filePath);
  if (!archiveStat.isFile() || archiveStat.size === 0) {
    throw new Error(`生成的部署包无效：${filePath}`);
  }
}

function createZip(sourceDirectory, archivePath) {
  if (process.platform === "win32") {
    const command = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem",
      "Add-Type -AssemblyName System.IO.Compression",
      "$zip = [System.IO.Compression.ZipFile]::Open($env:XIAOELONG_ZIP_TARGET, [System.IO.Compression.ZipArchiveMode]::Create)",
      "try { foreach ($file in Get-ChildItem -LiteralPath $env:XIAOELONG_ZIP_SOURCE -Recurse -File -Force) { $entry = $file.FullName.Substring($env:XIAOELONG_ZIP_SOURCE.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $zip.Dispose() }"
    ].join("; ");

    execFileSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      {
        env: {
          ...process.env,
          XIAOELONG_ZIP_SOURCE: sourceDirectory,
          XIAOELONG_ZIP_TARGET: archivePath
        },
        stdio: "inherit"
      }
    );
    return;
  }

  execFileSync("zip", ["-r", "-y", "-q", archivePath, "."], {
    cwd: sourceDirectory,
    stdio: "inherit"
  });
}

const version = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8")
).version;
const zipName = `XiaoELong-server-${version}.zip`;
const deployDirectory = path.join(repositoryRoot, "deploy");
const zipPath = path.join(deployDirectory, zipName);
const temporaryZipPath = path.join(
  deployDirectory,
  `XiaoELong-server-${version}.tmp-${process.pid}-${Date.now()}.zip`
);

// 前置检查：server 与 shared 的构建产物必须存在
await assertBuilt(path.join(repositoryRoot, "server", "dist", "index.js"), "server 构建产物");
await assertBuilt(path.join(repositoryRoot, "shared", "dist", "index.js"), "shared 构建产物");
await assertBuilt(path.join(repositoryRoot, "client", "dist", "index.html"), "client 构建产物");
await mkdir(deployDirectory, { recursive: true });

// 在临时目录组装部署包，避免污染 git 工作区
const staging = await mkdtemp(path.join(os.tmpdir(), "xiaoelong-server-deploy-"));
try {
  // 1. 只拷贝 git 中维护的发布配置。不要复制 deploy/server 整个目录，
  // 否则本机安装过的 node_modules、旧 dist 或上传文件会被误带进发布包。
  const deploySource = path.join(repositoryRoot, "deploy", "server");
  await mkdir(path.join(staging, "server", "src", "db"), { recursive: true });
  await mkdir(path.join(staging, "shared"), { recursive: true });
  await cp(
    path.join(deploySource, "readme-server.md"),
    path.join(staging, "readme-server.md")
  );
  await cp(
    path.join(repositoryRoot, "docs", "question-bank-sources.md"),
    path.join(staging, "QUESTION-BANK-SOURCES.md")
  );
  await cp(
    path.join(deploySource, "package.json"),
    path.join(staging, "package.json")
  );
  await cp(
    path.join(deploySource, "package-lock.json"),
    path.join(staging, "package-lock.json")
  );
  await cp(
    path.join(deploySource, "server", ".env.example"),
    path.join(staging, "server", ".env.example")
  );
  await cp(
    path.join(repositoryRoot, "server", "src", "db", "init.sql"),
    path.join(staging, "server", "src", "db", "init.sql")
  );

  // 2. 拷贝 server 构建产物与依赖清单（版本号随源码自动同步）
  await cp(
    path.join(repositoryRoot, "server", "dist"),
    path.join(staging, "server", "dist"),
    { recursive: true }
  );
  await cp(
    path.join(repositoryRoot, "server", "package.json"),
    path.join(staging, "server", "package.json")
  );

  // 3. 拷贝 shared 构建产物与依赖清单
  await cp(
    path.join(repositoryRoot, "shared", "dist"),
    path.join(staging, "shared", "dist"),
    { recursive: true }
  );
  await cp(
    path.join(repositoryRoot, "shared", "package.json"),
    path.join(staging, "shared", "package.json")
  );

  await cp(path.join(repositoryRoot, "client", "dist"), path.join(staging, "web"), { recursive: true });
  await cp(path.join(deploySource, "compose.yaml"), path.join(staging, "compose.yaml"));

  // 4. 保证 updates 目录存在（客户端更新文件静态目录），用占位文件确保被 zip 收录
  await mkdir(path.join(staging, "updates"), { recursive: true });
  await writeFile(path.join(staging, "updates", ".gitkeep"), "");

  // 5. 先生成同目录临时 zip，确认有效后再替换正式包。
  // rename 在同一文件系统内完成替换；打包或替换失败时，已有正式包保持不变。
  await rm(temporaryZipPath, { force: true });
  createZip(staging, temporaryZipPath);
  await assertArchive(temporaryZipPath);
  await rename(temporaryZipPath, zipPath);
} finally {
  await Promise.allSettled([
    rm(temporaryZipPath, { force: true }),
    rm(staging, { recursive: true, force: true })
  ]);
}

console.log(`已生成服务器部署包：${zipPath}`);
