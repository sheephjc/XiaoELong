import rawManifest from "./assets/xiaoelong-pet-manifest.json";

export type PetAnimationState = "idle" | "drag-right" | "drag-left" | "victory" | "defeat" | "draw";
export type PetDragDirection = "left" | "right";
export type PetReactionKind = "victory" | "defeat" | "draw";
export type PetDisplayMode = "dynamic" | "static" | "image";

export interface PetReaction {
  gameId: number;
  kind: PetReactionKind;
}

export interface PetAnimationDefinition {
  row: number;
  frames: number;
  fps: number;
  loops: number | null;
  reducedMotionFrame: number;
  reducedMotionDurationMs?: number;
}

export interface PetAnimationManifest {
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  animations: Record<PetAnimationState, PetAnimationDefinition>;
}

export const PET_ANIMATION_MANIFEST = rawManifest as PetAnimationManifest;
export const PET_DRAG_THRESHOLD_SQUARED = 25;
export const PET_DIRECTION_THRESHOLD_PX = 2;
export const PET_MAX_RENDER_SCALE = 3;

export interface PetAnimationControllerState {
  animation: PetAnimationState;
  dragging: boolean;
  activeReaction: PetReaction | null;
  pendingReaction: PetReaction | null;
  seenGameIds: number[];
}

export type PetAnimationAction =
  | { type: "reaction-received"; reaction: PetReaction }
  | { type: "drag-begin"; direction: PetDragDirection | null }
  | { type: "drag-direction"; direction: PetDragDirection }
  | { type: "drag-end" }
  | { type: "animation-complete" }
  | { type: "reset-visuals" };

export const INITIAL_PET_ANIMATION_STATE: PetAnimationControllerState = {
  animation: "idle",
  dragging: false,
  activeReaction: null,
  pendingReaction: null,
  seenGameIds: []
};

function animationForDirection(direction: PetDragDirection | null): PetAnimationState {
  return direction ? `drag-${direction}` : "idle";
}

function rememberGameId(seenGameIds: number[], gameId: number): number[] {
  return [...seenGameIds, gameId].slice(-32);
}

export function petAnimationReducer(
  state: PetAnimationControllerState,
  action: PetAnimationAction
): PetAnimationControllerState {
  switch (action.type) {
    case "reaction-received": {
      if (state.seenGameIds.includes(action.reaction.gameId)) {
        return state;
      }

      const seenGameIds = rememberGameId(state.seenGameIds, action.reaction.gameId);
      if (state.dragging) {
        return {
          ...state,
          pendingReaction: action.reaction,
          seenGameIds
        };
      }

      return {
        ...state,
        animation: action.reaction.kind,
        activeReaction: action.reaction,
        pendingReaction: null,
        seenGameIds
      };
    }

    case "drag-begin":
      return {
        ...state,
        animation: animationForDirection(action.direction),
        dragging: true,
        activeReaction: null
      };

    case "drag-direction":
      if (!state.dragging) {
        return state;
      }
      return {
        ...state,
        animation: animationForDirection(action.direction)
      };

    case "drag-end":
      if (!state.dragging) {
        return state;
      }
      if (state.pendingReaction) {
        return {
          ...state,
          animation: state.pendingReaction.kind,
          dragging: false,
          activeReaction: state.pendingReaction,
          pendingReaction: null
        };
      }
      return {
        ...state,
        animation: "idle",
        dragging: false,
        activeReaction: null
      };

    case "animation-complete":
      if (state.dragging || !state.activeReaction) {
        return state;
      }
      return {
        ...state,
        animation: "idle",
        activeReaction: null
      };

    case "reset-visuals":
      return {
        ...state,
        animation: "idle",
        dragging: false,
        activeReaction: null,
        pendingReaction: null
      };
  }
}

export function isPetDragThresholdExceeded(deltaX: number, deltaY: number): boolean {
  return deltaX * deltaX + deltaY * deltaY > PET_DRAG_THRESHOLD_SQUARED;
}

export function resolvePetDragDirection(
  previousScreenX: number,
  nextScreenX: number,
  fallback: PetDragDirection | null
): PetDragDirection | null {
  const deltaX = nextScreenX - previousScreenX;
  if (Math.abs(deltaX) < PET_DIRECTION_THRESHOLD_PX) {
    return fallback;
  }
  return deltaX < 0 ? "left" : "right";
}

export function normalizePetDisplayMode(
  value: unknown,
  legacyAnimationsEnabled?: boolean
): PetDisplayMode {
  if (value === "dynamic" || value === "static" || value === "image") {
    return value;
  }
  return legacyAnimationsEnabled === false ? "static" : "dynamic";
}

export function getNextPetDisplayMode(mode: PetDisplayMode): PetDisplayMode {
  switch (mode) {
    case "dynamic":
      return "static";
    case "static":
      return "image";
    case "image":
      return "dynamic";
  }
}

export function shouldUseStaticPetFrame(displayMode: PetDisplayMode, reducedMotion: boolean): boolean {
  return displayMode !== "dynamic" || reducedMotion;
}

export function resolvePetRenderScale(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio)) {
    return 1;
  }
  return Math.min(PET_MAX_RENDER_SCALE, Math.max(1, devicePixelRatio));
}

export function getPetReaction(gameId: number, winner: string | null, currentUserId: string): PetReaction {
  return {
    gameId,
    kind: winner === null ? "draw" : winner === currentUserId ? "victory" : "defeat"
  };
}
