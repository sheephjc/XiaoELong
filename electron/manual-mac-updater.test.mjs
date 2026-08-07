import { describe, expect, it, vi } from "vitest";
import manualMacUpdater from "./manual-mac-updater.js";

const {
  compareVersions,
  createMacUpdateDownloadUrl,
  isNewerVersion,
  loadMacUpdateManifest,
  validateMacUpdateManifest
} = manualMacUpdater;

const manifestUrl = "http://43.139.223.204:3001/updates/latest-mac.json";
const validManifest = {
  schemaVersion: 1,
  version: "1.3.2",
  fileName: "XiaoELong-1.3.2-mac-universal.dmg",
  sha256: "a".repeat(64),
  size: 123456,
  releaseDate: "2026-07-31T00:00:00.000Z"
};

describe("manual Mac updater", () => {
  it("compares numeric versions instead of lexical strings", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.3.2", "1.3.2")).toBe(0);
    expect(isNewerVersion("1.3.3", "1.3.2")).toBe(true);
    expect(isNewerVersion("2.0.0", "1.3.3")).toBe(true);
    expect(isNewerVersion("1.3.1", "1.3.2")).toBe(false);
  });

  it("accepts a versioned DMG manifest", () => {
    expect(validateMacUpdateManifest(validManifest)).toEqual(validManifest);
  });

  it("rejects mismatched filenames and invalid release metadata", () => {
    expect(() =>
      validateMacUpdateManifest({
        ...validManifest,
        fileName: "XiaoELong-1.3.1-mac-universal.dmg"
      })
    ).toThrow(/filename/);
    expect(() => validateMacUpdateManifest({ ...validManifest, sha256: "bad" })).toThrow(/SHA-256/);
    expect(() => validateMacUpdateManifest({ ...validManifest, size: 0 })).toThrow(/size/);
    expect(() =>
      validateMacUpdateManifest({ ...validManifest, releaseDate: "July 31, 2026" })
    ).toThrow(/date/);
  });

  it("builds only a versioned HTTPS GitHub Release URL", () => {
    expect(
      createMacUpdateDownloadUrl(
        validManifest,
        "https://github.com/sheephjc/XiaoELong/releases/download/"
      )
    ).toBe(
      "https://github.com/sheephjc/XiaoELong/releases/download/v1.3.2/XiaoELong-1.3.2-mac-universal.dmg"
    );
    expect(() =>
      createMacUpdateDownloadUrl(validManifest, "http://43.139.223.204:3001/updates/")
    ).toThrow(/HTTPS/);
    expect(() =>
      createMacUpdateDownloadUrl(
        validManifest,
        "https://user@github.com/sheephjc/XiaoELong/releases/download/"
      )
    ).toThrow(/clean HTTPS/);
    expect(() =>
      createMacUpdateDownloadUrl(
        validManifest,
        "https://github.com/sheephjc/XiaoELong/releases/download/?mirror=other"
      )
    ).toThrow(/clean HTTPS/);
  });

  it("loads and validates a cache-busted manifest request", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(validManifest)
    }));

    await expect(loadMacUpdateManifest({ manifestUrl, fetchImpl })).resolves.toEqual(validManifest);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^http:\/\/43\.139\.223\.204:3001\/updates\/latest-mac\.json\?ts=\d+$/);
  });

  it("rejects unsuccessful manifest responses", async () => {
    await expect(
      loadMacUpdateManifest({
        manifestUrl,
        fetchImpl: async () => ({
          status: 404,
          headers: new Headers({ "content-type": "application/json" })
        })
      })
    ).rejects.toThrow(/404/);
  });

  it("rejects redirects, non-JSON and oversized manifests", async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      expect(options.redirect).toBe("error");
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "{}"
      };
    });

    await expect(loadMacUpdateManifest({ manifestUrl, fetchImpl })).rejects.toThrow(/not JSON/);
    await expect(
      loadMacUpdateManifest({
        manifestUrl,
        fetchImpl: async () => ({
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: async () => " ".repeat(64 * 1024 + 1)
        })
      })
    ).rejects.toThrow(/too large/);
  });
});
