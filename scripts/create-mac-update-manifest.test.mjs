import { describe, expect, it } from "vitest";
import {
  createMacUpdateManifest
} from "./create-mac-update-manifest.mjs";

describe("Mac update manifest generator", () => {
  it("creates deterministic release metadata for a universal DMG", () => {
    expect(
      createMacUpdateManifest({
        version: "1.3.2",
        sha256: "b".repeat(64),
        size: 987654,
        releaseDate: "2026-07-31T12:34:56.789Z"
      })
    ).toEqual({
      schemaVersion: 1,
      version: "1.3.2",
      fileName: "XiaoELong-1.3.2-mac-universal.dmg",
      sha256: "b".repeat(64),
      size: 987654,
      releaseDate: "2026-07-31T12:34:56.789Z"
    });
  });

  it("rejects version strings that cannot map to a stable release tag", () => {
    expect(() =>
      createMacUpdateManifest({
        version: "1.3.2-beta.1",
        sha256: "b".repeat(64),
        size: 987654
      })
    ).toThrow(/version/);
  });
});
