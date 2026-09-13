// scripts/build-update-deploy.mjs
// 将 electron-builder 生成的 Windows 自动更新三件套组装为服务器上传 ZIP，
// 并生成包含客户端文件、服务器部署包与更新 ZIP 的 SHA-256 清单。

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const version = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8")
).version;
const releaseDirectory = path.join(repositoryRoot, "release");
const deployDirectory = path.join(repositoryRoot, "deploy");
const updateFileNames = [
  `XiaoELong Setup ${version}.exe`,
  `XiaoELong Setup ${version}.exe.blockmap`,
  "latest.yml"
];
const updateZipName = `XiaoELong-updates-${version}.zip`;
const serverZipName = `XiaoELong-server-${version}.zip`;
const checksumName = `SHA256-${version}.txt`;
const updateZipPath = path.join(deployDirectory, updateZipName);
const checksumPath = path.join(deployDirectory, checksumName);
const temporaryUpdateZipPath = path.join(
  deployDirectory,
  `${updateZipName}.tmp-${process.pid}-${Date.now()}`
);
const temporaryChecksumPath = path.join(
  deployDirectory,
  `${checksumName}.tmp-${process.pid}-${Date.now()}`
);

async function assertFile(filePath) {
  try {
    if ((await stat(filePath)).isFile()) {
      return;
    }
  } catch {
    // 统一在下面抛出带操作提示的错误。
  }
  throw new Error(`自动更新文件缺失：${filePath}。请先运行 npm run electron:dist。`);
}

function createZip(sourceDirectory, archivePath) {
  if (process.platform === "win32") {
    const command = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem",
      "Add-Type -AssemblyName System.IO.Compression",
      "$zip = [System.IO.Compression.ZipFile]::Open($env:XIAOELONG_UPDATE_TARGET, [System.IO.Compression.ZipArchiveMode]::Create)",
      "try { foreach ($file in Get-ChildItem -LiteralPath $env:XIAOELONG_UPDATE_SOURCE -Recurse -File -Force) { $entry = $file.FullName.Substring($env:XIAOELONG_UPDATE_SOURCE.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $zip.Dispose() }"
    ].join("; ");
    execFileSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      {
        env: {
          ...process.env,
          XIAOELONG_UPDATE_SOURCE: sourceDirectory,
          XIAOELONG_UPDATE_TARGET: archivePath
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

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

await mkdir(deployDirectory, { recursive: true });
for (const fileName of updateFileNames) {
  await assertFile(path.join(releaseDirectory, fileName));
}

const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), "xiaoelong-updates-deploy-"));
try {
  for (const fileName of updateFileNames) {
    await cp(path.join(releaseDirectory, fileName), path.join(stagingDirectory, fileName));
  }

  await rm(temporaryUpdateZipPath, { force: true });
  createZip(stagingDirectory, temporaryUpdateZipPath);
  await assertFile(temporaryUpdateZipPath);
  await rename(temporaryUpdateZipPath, updateZipPath);

  const checksumFiles = [
    ...updateFileNames.map((fileName) => path.join(releaseDirectory, fileName)),
    path.join(deployDirectory, serverZipName),
    updateZipPath
  ];
  const existingChecksumFiles = [];
  for (const filePath of checksumFiles) {
    try {
      if ((await stat(filePath)).isFile()) {
        existingChecksumFiles.push(filePath);
      }
    } catch {
      // 服务器 ZIP 可独立生成；不存在时不阻止客户端更新包打包。
    }
  }
  const checksumLines = [];
  for (const filePath of existingChecksumFiles) {
    checksumLines.push(`${await sha256(filePath)}  ${path.basename(filePath)}`);
  }
  await writeFile(temporaryChecksumPath, `${checksumLines.join("\n")}\n`, "utf8");
  await rename(temporaryChecksumPath, checksumPath);
} finally {
  await Promise.allSettled([
    rm(temporaryUpdateZipPath, { force: true }),
    rm(temporaryChecksumPath, { force: true }),
    rm(stagingDirectory, { recursive: true, force: true })
  ]);
}

console.log(`已生成自动更新包：${updateZipPath}`);
console.log(`已生成校验清单：${checksumPath}`);
