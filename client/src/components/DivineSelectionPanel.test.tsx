import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DEITY_CATALOG,
  getNextDeityThreshold,
  type DeityRank,
  type DeityWorshipTodayResponse
} from "@xiaoelong/shared";
import { ConstellationMap } from "./DivineSelectionPanel";

const WORSHIP_TOTALS: Record<DeityRank, number> = {
  mortal: 0,
  demigod: 2,
  true_god: 5,
  main_god: 10,
  creator_god: 20
};

function dataForRank(rank: DeityRank): DeityWorshipTodayResponse {
  return {
    worshipDay: "2026-08-06",
    todayWorship: null,
    deities: DEITY_CATALOG.map((deity) => ({
      deityId: deity.id,
      totalWorships: WORSHIP_TOTALS[rank],
      rank,
      nextThreshold: getNextDeityThreshold(rank)
    }))
  };
}

function count(markup: string, pattern: RegExp): number {
  return markup.match(pattern)?.length ?? 0;
}

describe("ConstellationMap rank visuals", () => {
  it.each<[DeityRank, number, number, "plain" | "plate"]>([
    ["mortal", 0, 0, "plain"],
    ["demigod", 0, 0, "plain"],
    ["true_god", 0, 49, "plate"],
    ["main_god", 7, 49, "plate"],
    ["creator_god", 7, 49, "plate"]
  ])(
    "renders only the decorations allowed for %s",
    (rank, wingCount, particleCount, identityStyle) => {
      const markup = renderToStaticMarkup(
        <ConstellationMap data={dataForRank(rank)} mode="full" />
      );

      expect(count(markup, /class="throne-wings"/g)).toBe(wingCount);
      expect(count(markup, /class="throne-particle throne-particle-\d"/g)).toBe(particleCount);
      expect(count(markup, new RegExp(`throne-identity--${identityStyle}`, "g"))).toBe(7);
    }
  );
});
