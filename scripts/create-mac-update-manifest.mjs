import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manualMacUpdater from "../electron/manual-mac-updater.js";

const { validateMacUpdateManifest } = manualMacUpdater;
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const manifestKeys = [
  "fileName",
  "releaseDate",
  "schemaVersion",
  "sha256",
  "size",
  "version"
].sort();

export async function calculateSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export function createMacUpdateManifest({
  version,
  sha256,
  size,
  releaseDate = new Date().toISOString()
}) {
  return validateMacUpdateManifest({
    schemaVersion: 1,
    version,
    fileName: `XiaoELong-${version}-mac-universal.dmg`,
    sha256,
    size,
    releaseDate
  });
}

async function readReleaseContext(rootDirectory) {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDirectory, "package.json"), "utf8")
  );
  const version = String(packageJson.version ?? "");
  const fileName = `XiaoELong-${version}-mac-universal.dmg`;
  const dmgPath = path.join(rootDirectory, "release", fileName);
  const manifestPath = path.join(rootDirectory, "release", "latest-mac.json");
  const fileStats = await stat(dmgPath);
  if (!fileStats.isFile() || !Number.isSafeInteger(fileStats.size) || fileStats.size <= 0) {
    throw new Error(`Mac DMG is invalid: ${dmgPath}`);
  }

  return {
    version,
    fileName,
    dmgPath,
    manifestPath,
    size: fileStats.size,
    sha256: await calculateSha256(dmgPath)
  };
}

export async function generateMacUpdateManifest(rootDirectory = repositoryRoot) {
  const context = await readReleaseContext(rootDirectory);
  const manifest = createMacUpdateManifest(context);
  await writeFile(context.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, manifestPath: context.manifestPath };
}

export async function checkMacUpdateManifest(rootDirectory = repositoryRoot) {
  const context = await readReleaseContext(rootDirectory);
  const rawManifest = JSON.parse(await readFile(context.manifestPath, "utf8"));
  const actualKeys = Object.keys(rawManifest).sort();
  if (actualKeys.join("\n") !== manifestKeys.join("\n")) {
    throw new Error("Mac update manifest fields do not match the supported schema.");
  }

  const manifest = validateMacUpdateManifest(rawManifest);
  if (
    manifest.version !== context.version ||
    manifest.fileName !== context.fileName ||
    manifest.sha256 !== context.sha256 ||
    manifest.size !== context.size
  ) {
    throw new Error("Mac update manifest does not match the built DMG.");
  }

  return { manifest, manifestPath: context.manifestPath };
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  const result = process.argv.includes("--check")
    ? await checkMacUpdateManifest()
    : await generateMacUpdateManifest();
  const action = process.argv.includes("--check") ? "Verified" : "Created";
  console.log(`${action} ${result.manifestPath} for XiaoELong ${result.manifest.version}.`);
}
