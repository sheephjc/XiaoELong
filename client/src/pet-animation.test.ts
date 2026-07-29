import { describe, expect, it } from "vitest";
import {
  INITIAL_PET_ANIMATION_STATE,
  PET_ANIMATION_MANIFEST,
  getPetReaction,
  getNextPetDisplayMode,
  isPetDragThresholdExceeded,
  normalizePetDisplayMode,
  petAnimationReducer,
  resolvePetDragDirection,
  resolvePetRenderScale,
  shouldUseStaticPetFrame
} from "./pet-animation";

describe("pet animation manifest", () => {
  it("keeps every animation inside the six-row eight-column atlas", () => {
    expect(PET_ANIMATION_MANIFEST.cellWidth).toBe(384);
    expect(PET_ANIMATION_MANIFEST.cellHeight).toBe(416);
    expect(PET_ANIMATION_MANIFEST.columns).toBe(8);
    expect(PET_ANIMATION_MANIFEST.rows).toBe(6);
    for (const definition of Object.values(PET_ANIMATION_MANIFEST.animations)) {
      expect(definition.row).toBeGreaterThanOrEqual(0);
      expect(definition.row).toBeLessThan(PET_ANIMATION_MANIFEST.rows);
      expect(definition.frames).toBeGreaterThan(0);
      expect(definition.frames).toBeLessThanOrEqual(PET_ANIMATION_MANIFEST.columns);
      expect(definition.reducedMotionFrame).toBeLessThan(definition.frames);
    }
  });
});

describe("pet drag gestures", () => {
  it("preserves the existing strict five-pixel drag threshold", () => {
    expect(isPetDragThresholdExceeded(3, 4)).toBe(false);
    expect(isPetDragThresholdExceeded(5, 1)).toBe(true);
  });

  it("switches on meaningful horizontal movement and retains the previous direction otherwise", () => {
    expect(resolvePetDragDirection(100, 104, null)).toBe("right");
    expect(resolvePetDragDirection(100, 96, null)).toBe("left");
    expect(resolvePetDragDirection(100, 101, "left")).toBe("left");
  });
});

describe("pet playback preferences", () => {
  it("migrates legacy animation preferences and preserves valid display modes", () => {
    expect(normalizePetDisplayMode("image", true)).toBe("image");
    expect(normalizePetDisplayMode("static", true)).toBe("static");
    expect(normalizePetDisplayMode(undefined, false)).toBe("static");
    expect(normalizePetDisplayMode("invalid", true)).toBe("dynamic");
  });

  it("cycles through dynamic, static frame, and original image modes", () => {
    expect(getNextPetDisplayMode("dynamic")).toBe("static");
    expect(getNextPetDisplayMode("static")).toBe("image");
    expect(getNextPetDisplayMode("image")).toBe("dynamic");
  });

  it("uses a representative frame when animations are disabled or reduced motion is requested", () => {
    expect(shouldUseStaticPetFrame("static", false)).toBe(true);
    expect(shouldUseStaticPetFrame("dynamic", true)).toBe(true);
    expect(shouldUseStaticPetFrame("dynamic", false)).toBe(false);
  });

  it("uses the display pixel ratio for a sharper canvas without unbounded upscaling", () => {
    expect(resolvePetRenderScale(1)).toBe(1);
    expect(resolvePetRenderScale(1.5)).toBe(1.5);
    expect(resolvePetRenderScale(3)).toBe(3);
    expect(resolvePetRenderScale(4)).toBe(3);
    expect(resolvePetRenderScale(Number.NaN)).toBe(1);
  });
});

describe("pet game reactions", () => {
  it("maps winners to victory, defeat, and draw", () => {
    expect(getPetReaction(1, "me", "me").kind).toBe("victory");
    expect(getPetReaction(2, "other", "me").kind).toBe("defeat");
    expect(getPetReaction(3, null, "me").kind).toBe("draw");
  });

  it("plays a result immediately and returns to idle when it completes", () => {
    const reacting = petAnimationReducer(INITIAL_PET_ANIMATION_STATE, {
      type: "reaction-received",
      reaction: { gameId: 11, kind: "victory" }
    });
    expect(reacting.animation).toBe("victory");
    expect(petAnimationReducer(reacting, { type: "animation-complete" }).animation).toBe("idle");
  });

  it("queues a result received during dragging and plays it on release", () => {
    const dragging = petAnimationReducer(INITIAL_PET_ANIMATION_STATE, {
      type: "drag-begin",
      direction: "right"
    });
    const queued = petAnimationReducer(dragging, {
      type: "reaction-received",
      reaction: { gameId: 12, kind: "draw" }
    });
    expect(queued.animation).toBe("drag-right");
    expect(queued.pendingReaction?.kind).toBe("draw");
    expect(petAnimationReducer(queued, { type: "drag-end" }).animation).toBe("draw");
  });

  it("lets a real drag interrupt an active result and ignores duplicate game results", () => {
    const reaction = { gameId: 13, kind: "defeat" } as const;
    const reacting = petAnimationReducer(INITIAL_PET_ANIMATION_STATE, {
      type: "reaction-received",
      reaction
    });
    const dragging = petAnimationReducer(reacting, { type: "drag-begin", direction: "left" });
    expect(dragging.animation).toBe("drag-left");
    expect(dragging.activeReaction).toBeNull();
    expect(petAnimationReducer(dragging, { type: "reaction-received", reaction })).toBe(dragging);
  });

  it("returns to the neutral image when visual interactions are disabled", () => {
    const reacting = petAnimationReducer(INITIAL_PET_ANIMATION_STATE, {
      type: "reaction-received",
      reaction: { gameId: 14, kind: "victory" }
    });
    const reset = petAnimationReducer(reacting, { type: "reset-visuals" });
    expect(reset.animation).toBe("idle");
    expect(reset.activeReaction).toBeNull();
    expect(reset.pendingReaction).toBeNull();
    expect(reset.seenGameIds).toEqual([14]);
  });
});
