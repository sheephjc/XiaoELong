import { PointerEvent, useEffect, useReducer, useRef } from "react";
import type { MoodEmoji } from "@xiaoelong/shared";
import mascotHitMaskImage from "../assets/xiaoelong-mascot-hitmask.png";
import mascotImage from "../assets/xiaoelong-mascot.png";
import {
  INITIAL_PET_ANIMATION_STATE,
  isPetDragThresholdExceeded,
  petAnimationReducer,
  resolvePetDragDirection,
  type PetDisplayMode,
  type PetDragDirection,
  type PetReaction
} from "../pet-animation";
import { PetSprite, type PetSpriteHandle } from "./PetSprite";

interface AvatarDockProps {
  open: boolean;
  nickname: string;
  displayMode: PetDisplayMode;
  reaction?: PetReaction | null;
  moodPrompt?: {
    options: MoodEmoji[];
    selectedMood: MoodEmoji | null;
    loading: boolean;
    onSelect: (emoji: MoodEmoji) => void | Promise<void>;
  };
  onToggle: () => void;
  onSettings: () => void;
}

export function AvatarDock(props: AvatarDockProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const spriteRef = useRef<PetSpriteHandle | null>(null);
  const moodPromptRef = useRef<HTMLDivElement | null>(null);
  const clickThroughRef = useRef(false);
  const displayModeRef = useRef(props.displayMode);
  const lastMousePointRef = useRef({ x: 0, y: 0, hasPoint: false });
  const [petAnimation, dispatchPetAnimation] = useReducer(petAnimationReducer, INITIAL_PET_ANIMATION_STATE);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastScreenX: 0,
    lastDirection: null as PetDragDirection | null,
    dragging: false
  });

  displayModeRef.current = props.displayMode;

  useEffect(() => {
    if (props.displayMode === "image") {
      dispatchPetAnimation({ type: "reset-visuals" });
    }
  }, [props.displayMode]);

  useEffect(() => {
    if (props.reaction && displayModeRef.current !== "image") {
      dispatchPetAnimation({ type: "reaction-received", reaction: props.reaction });
    }
  }, [props.reaction]);

  function setAvatarClickThrough(enabled: boolean): void {
    if (clickThroughRef.current === enabled) {
      return;
    }

    clickThroughRef.current = enabled;
    window.xiaoelongDesktop?.setAvatarClickThrough?.(enabled);
  }

  function endActiveDrag(pointerId?: number): boolean | null {
    const activePointerId = dragRef.current.pointerId;
    if (activePointerId === -1 || (pointerId !== undefined && activePointerId !== pointerId)) {
      return null;
    }

    const wasDragging = dragRef.current.dragging;
    dragRef.current = {
      pointerId: -1,
      startX: 0,
      startY: 0,
      lastScreenX: 0,
      lastDirection: null,
      dragging: false
    };

    const button = buttonRef.current;
    if (button?.hasPointerCapture(activePointerId)) {
      button.releasePointerCapture(activePointerId);
    }
    window.xiaoelongDesktop?.endDrag?.();
    if (wasDragging && displayModeRef.current !== "image") {
      dispatchPetAnimation({ type: "drag-end" });
    }
    return wasDragging;
  }

  function isPointInRect(clientX: number, clientY: number, rect: DOMRect): boolean {
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function isPointOnMascot(clientX: number, clientY: number): boolean {
    const button = buttonRef.current;
    if (!button || !isPointInRect(clientX, clientY, button.getBoundingClientRect())) {
      return false;
    }
    return spriteRef.current?.isOpaqueAt(clientX, clientY) ?? true;
  }

  function isPointInMoodPrompt(clientX: number, clientY: number): boolean {
    const prompt = moodPromptRef.current;
    return prompt ? isPointInRect(clientX, clientY, prompt.getBoundingClientRect()) : false;
  }

  function isInteractivePoint(clientX: number, clientY: number): boolean {
    return isPointOnMascot(clientX, clientY) || isPointInMoodPrompt(clientX, clientY);
  }

  function updateClickThroughForPoint(clientX: number, clientY: number): void {
    lastMousePointRef.current = { x: clientX, y: clientY, hasPoint: true };
    if (dragRef.current.pointerId !== -1) {
      setAvatarClickThrough(false);
      return;
    }
    setAvatarClickThrough(!isInteractivePoint(clientX, clientY));
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      updateClickThroughForPoint(event.clientX, event.clientY);
    }

    function handleMouseLeave(): void {
      if (dragRef.current.pointerId !== -1) {
        setAvatarClickThrough(false);
        return;
      }
      setAvatarClickThrough(true);
    }

    function handleMouseUp(event: MouseEvent): void {
      if (event.button !== 0 || dragRef.current.pointerId === -1) {
        return;
      }

      window.setTimeout(() => {
        if (dragRef.current.pointerId === -1) {
          return;
        }
        endActiveDrag();
        if (lastMousePointRef.current.hasPoint) {
          updateClickThroughForPoint(lastMousePointRef.current.x, lastMousePointRef.current.y);
        }
      }, 0);
    }

    function handleWindowBlur(): void {
      if (endActiveDrag() !== null) {
        setAvatarClickThrough(true);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      endActiveDrag();
      setAvatarClickThrough(false);
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return;
    }

    if (!isPointOnMascot(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();
    endActiveDrag();
    setAvatarClickThrough(false);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      lastScreenX: event.screenX,
      lastDirection: null,
      dragging: false
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    window.xiaoelongDesktop?.startDrag?.();
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) === 0) {
      endActiveDrag(event.pointerId);
      updateClickThroughForPoint(event.clientX, event.clientY);
      return;
    }

    const deltaX = event.screenX - dragRef.current.startX;
    const deltaY = event.screenY - dragRef.current.startY;
    if (!dragRef.current.dragging && isPetDragThresholdExceeded(deltaX, deltaY)) {
      dragRef.current.dragging = true;
      if (displayModeRef.current !== "image") {
        const direction = resolvePetDragDirection(dragRef.current.startX, event.screenX, null);
        dragRef.current.lastDirection = direction;
        dispatchPetAnimation({ type: "drag-begin", direction });
      }
    }

    if (dragRef.current.dragging) {
      if (displayModeRef.current !== "image") {
        const direction = resolvePetDragDirection(
          dragRef.current.lastScreenX,
          event.screenX,
          dragRef.current.lastDirection
        );
        if (direction && direction !== dragRef.current.lastDirection) {
          dragRef.current.lastDirection = direction;
          dispatchPetAnimation({ type: "drag-direction", direction });
        }
      }
      dragRef.current.lastScreenX = event.screenX;
      window.xiaoelongDesktop?.moveDrag?.();
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>): void {
    const wasDragging = endActiveDrag(event.pointerId);
    if (wasDragging === null) {
      return;
    }

    if (!wasDragging && isPointOnMascot(event.clientX, event.clientY)) {
      props.onToggle();
    }

    updateClickThroughForPoint(event.clientX, event.clientY);
  }

  return (
    <div className={`avatar-widget ${props.moodPrompt ? "has-mood-prompt" : ""}`}>
      {props.moodPrompt ? (
        <div
          className="avatar-mood-prompt"
          ref={moodPromptRef}
          role="dialog"
          aria-label="每日心情"
          onMouseEnter={() => setAvatarClickThrough(false)}
        >
          <span className="avatar-mood-title">今日心情</span>
          <div className="avatar-mood-options">
            {props.moodPrompt.options.map((emoji) => (
              <button
                type="button"
                className={props.moodPrompt?.selectedMood === emoji ? "selected" : ""}
                disabled={props.moodPrompt?.loading}
                key={emoji}
                onClick={() => {
                  void props.moodPrompt?.onSelect(emoji);
                }}
              >
                <span className="mood-emoji">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`avatar-dock ${props.open ? "open" : ""}`}
        ref={buttonRef}
        aria-label={`${props.open ? "收起" : "展开"}小鳄龙面板，当前用户 ${props.nickname}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          endActiveDrag();
          if (lastMousePointRef.current.hasPoint) {
            updateClickThroughForPoint(lastMousePointRef.current.x, lastMousePointRef.current.y);
          }
        }}
        onLostPointerCapture={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) {
            return;
          }
          endActiveDrag(event.pointerId);
          if (lastMousePointRef.current.hasPoint) {
            updateClickThroughForPoint(lastMousePointRef.current.x, lastMousePointRef.current.y);
          }
        }}
        onContextMenu={(event) => {
          if (!isPointOnMascot(event.clientX, event.clientY)) {
            return;
          }

          event.preventDefault();
          endActiveDrag();
          props.onSettings();
        }}
      >
        <PetSprite
          ref={spriteRef}
          animation={petAnimation.animation}
          displayMode={props.displayMode}
          fallbackImageUrl={mascotImage}
          fallbackMaskUrl={mascotHitMaskImage}
          onAnimationComplete={() => dispatchPetAnimation({ type: "animation-complete" })}
          onFrameRendered={() => {
            if (lastMousePointRef.current.hasPoint && dragRef.current.pointerId === -1) {
              updateClickThroughForPoint(lastMousePointRef.current.x, lastMousePointRef.current.y);
            }
          }}
        />
      </button>
    </div>
  );
}
