const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_MANIFEST_BYTES = 64 * 1024;

function parseVersion(version) {
  if (typeof version !== "string") {
    throw new Error("Update version must be a string.");
  }

  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Invalid update version: ${version}`);
  }

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`Update version is outside the supported range: ${version}`);
  }

  return parts;
}

function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] > right[index] ? 1 : -1;
    }
  }

  return 0;
}

function isNewerVersion(candidateVersion, currentVersion) {
  return compareVersions(candidateVersion, currentVersion) > 0;
}

function validateMacUpdateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Mac update manifest must be an object.");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("Unsupported Mac update manifest schema.");
  }

  const version = String(value.version ?? "");
  parseVersion(version);

  const expectedFileName = `XiaoELong-${version}-mac-universal.dmg`;
  if (value.fileName !== expectedFileName) {
    throw new Error("Mac update filename does not match its version.");
  }

  const sha256 = String(value.sha256 ?? "").toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error("Mac update SHA-256 is invalid.");
  }

  const size = Number(value.size);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Mac update size is invalid.");
  }

  const releaseDate = String(value.releaseDate ?? "");
  if (
    !ISO_DATE_PATTERN.test(releaseDate) ||
    Number.isNaN(Date.parse(releaseDate)) ||
    new Date(releaseDate).toISOString() !== releaseDate
  ) {
    throw new Error("Mac update release date is invalid.");
  }

  return {
    schemaVersion: 1,
    version,
    fileName: expectedFileName,
    sha256,
    size,
    releaseDate
  };
}

function createMacUpdateDownloadUrl(manifest, downloadBaseUrl) {
  const validatedManifest = validateMacUpdateManifest(manifest);
  const baseUrl = new URL(downloadBaseUrl);
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("Mac update download base URL must be a clean HTTPS URL.");
  }

  if (!baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname = `${baseUrl.pathname}/`;
  }

  const downloadUrl = new URL(
    `v${validatedManifest.version}/${validatedManifest.fileName}`,
    baseUrl
  );
  if (
    downloadUrl.protocol !== "https:" ||
    downloadUrl.origin !== baseUrl.origin ||
    !downloadUrl.pathname.startsWith(baseUrl.pathname) ||
    downloadUrl.search ||
    downloadUrl.hash
  ) {
    throw new Error("Mac update download URL is invalid.");
  }

  return downloadUrl.toString();
}

async function loadMacUpdateManifest({
  manifestUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is unavailable for Mac update checks.");
  }

  const sourceUrl = new URL(manifestUrl);
  if (
    !["http:", "https:"].includes(sourceUrl.protocol) ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.search ||
    sourceUrl.hash
  ) {
    throw new Error("Mac update manifest URL is invalid.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestUrl = new URL(sourceUrl);
  requestUrl.searchParams.set("ts", String(Date.now()));

  try {
    const response = await fetchImpl(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache"
      },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal
    });

    if (!response || response.status !== 200) {
      throw new Error(`Mac update manifest request failed with status ${response?.status ?? "unknown"}.`);
    }

    const contentType = response.headers?.get?.("content-type") ?? "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw new Error("Mac update manifest response is not JSON.");
    }

    const declaredLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MANIFEST_BYTES) {
      throw new Error("Mac update manifest is too large.");
    }

    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_MANIFEST_BYTES) {
      throw new Error("Mac update manifest is too large.");
    }

    let value;
    try {
      value = JSON.parse(body);
    } catch {
      throw new Error("Mac update manifest contains invalid JSON.");
    }

    return validateMacUpdateManifest(value);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  compareVersions,
  createMacUpdateDownloadUrl,
  isNewerVersion,
  loadMacUpdateManifest,
  parseVersion,
  validateMacUpdateManifest
};
