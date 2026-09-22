import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const deployDir = path.join(root, "deploy");
const outputDir = path.join(deployDir, "pet-page");
const zipPath = path.join(deployDir, `XiaoELong-pet-${version}.zip`);
const tempZipPath = `${zipPath}.tmp-${process.pid}`;
const staging = await mkdtemp(path.join(os.tmpdir(), "xiaoelong-pet-"));

try {
  const clientDir = path.join(root, "client");
  const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.json", "--noEmit"], { cwd: clientDir, stdio: "inherit" });
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.node.json", "--noEmit"], { cwd: clientDir, stdio: "inherit" });
  execFileSync(process.execPath, [vite, "build", "--base=/pet/", "--outDir", outputDir, "--emptyOutDir"], {
    cwd: clientDir, stdio: "inherit", env: { ...process.env, VITE_SERVER_URL: "http://111.231.19.104:3001" }
  });
  const indexPath = path.join(outputDir, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  await writeFile(indexPath, indexHtml.replace("<title>XiaoELong MVP</title>",
    '<title>小鳄龙桌面组件 · Windows 与 macOS 下载</title>\n    <meta name="description" content="下载小鳄龙桌面组件，和朋友聊天、玩五子棋，享受轻松的桌面陪伴。">'), "utf8");

  await mkdir(path.join(staging, "pet"), { recursive: true });
  await cp(outputDir, path.join(staging, "pet"), { recursive: true });
  await rm(tempZipPath, { force: true });

  if (process.platform === "win32") {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; Add-Type -AssemblyName System.IO.Compression; $zip=[System.IO.Compression.ZipFile]::Open($env:XIAOELONG_PET_TARGET,[System.IO.Compression.ZipArchiveMode]::Create); try { foreach ($file in Get-ChildItem -LiteralPath $env:XIAOELONG_PET_SOURCE -Recurse -File) { $entry=$file.FullName.Substring($env:XIAOELONG_PET_SOURCE.Length+1).Replace([char]92,'/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $zip.Dispose() }"
    ], { stdio: "inherit", env: { ...process.env, XIAOELONG_PET_SOURCE: staging, XIAOELONG_PET_TARGET: tempZipPath } });
  } else {
    execFileSync("zip", ["-r", "-q", tempZipPath, "pet"], { cwd: staging, stdio: "inherit" });
  }

  if (!(await stat(tempZipPath)).size) throw new Error("Empty pet page archive");
  await rename(tempZipPath, zipPath);
  console.log(`已生成 /pet 静态发布页：${zipPath}`);
} finally {
  await rm(staging, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  await rm(tempZipPath, { force: true });
}
