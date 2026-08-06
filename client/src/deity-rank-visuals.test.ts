import { describe, expect, it } from "vitest";
import type { DeityRank } from "@xiaoelong/shared";
import { getDeityRankVisuals } from "./deity-rank-visuals";

describe("getDeityRankVisuals", () => {
  it.each<[DeityRank, boolean, boolean, boolean]>([
    ["mortal", false, false, false],
    ["demigod", false, false, false],
    ["true_god", false, true, true],
    ["main_god", true, true, true],
    ["creator_god", true, true, true]
  ])(
    "%s maps to the intended energy wings, particles, and identity treatment",
    (rank, showEnergyWings, showParticles, useIdentityPlate) => {
      expect(getDeityRankVisuals(rank)).toEqual({
        showEnergyWings,
        showParticles,
        useIdentityPlate
      });
    }
  );
});
