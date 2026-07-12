import { PointerEvent, useEffect, useRef } from "react";
import type { MoodEmoji } from "@xiaoelong/shared";
import mascotHitMaskImage from "../assets/xiaoelong-mascot-hitmask.png";
import mascotImage from "../assets/xiaoelong-mascot.png";

const MASCOT_HIT_ALPHA_THRESHOLD = 32;

interface AvatarDockProps {
  open: boolean;
  nickname: string;
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const moodPromptRef = useRef<HTMLDivElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const clickThroughRef = useRef(false);
  const lastMousePointRef = useRef({ x: 0, y: 0, hasPoint: false });
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    dragging: false
  });

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
      dragging: false
    };

    const button = buttonRef.current;
    if (button?.hasPointerCapture(activePointerId)) {
      button.releasePointerCapture(activePointerId);
    }
    window.xiaoelongDesktop?.endDrag?.();
    return wasDragging;
  }

  function isPointInRect(clientX: number, clientY: number, rect: DOMRect): boolean {
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function getMaskPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const image = imageRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!image || !maskCanvas) {
      return null;
    }

    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || maskCanvas.width <= 0 || maskCanvas.height <= 0) {
      return null;
    }

    const scale = Math.min(rect.width / maskCanvas.width, rect.height / maskCanvas.height);
    const renderedWidth = maskCanvas.width * scale;
    const renderedHeight = maskCanvas.height * scale;
    const renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
    const renderedTop = rect.top + (rect.height - renderedHeight) / 2;
    const renderedRight = renderedLeft + renderedWidth;
    const renderedBottom = renderedTop + renderedHeight;

    if (clientX < renderedLeft || clientX > renderedRight || clientY < renderedTop || clientY > renderedBottom) {
      return null;
    }

    return {
      x: Math.min(maskCanvas.width - 1, Math.max(0, Math.floor(((clientX - renderedLeft) / renderedWidth) * maskCanvas.width))),
      y: Math.min(maskCanvas.height - 1, Math.max(0, Math.floor(((clientY - renderedTop) / renderedHeight) * maskCanvas.height)))
    };
  }

  function isPointOnMascot(clientX: number, clientY: number): boolean {
    const button = buttonRef.current;
    if (!button || !isPointInRect(clientX, clientY, button.getBoundingClientRect())) {
      return false;
    }

    const maskPoint = getMaskPoint(clientX, clientY);
    const maskContext = maskContextRef.current;
    if (!maskPoint || !maskContext) {
      return true;
    }

    return maskContext.getImageData(maskPoint.x, maskPoint.y, 1, 1).data[3] > MASCOT_HIT_ALPHA_THRESHOLD;
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
    let cancelled = false;
    const maskImage = new Image();
    maskImage.src = mascotHitMaskImage;

    maskImage.onload = () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = maskImage.naturalWidth;
      canvas.height = maskImage.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return;
      }

      context.drawImage(maskImage, 0, 0);
      maskCanvasRef.current = canvas;
      maskContextRef.current = context;

      if (lastMousePointRef.current.hasPoint) {
        updateClickThroughForPoint(lastMousePointRef.current.x, lastMousePointRef.current.y);
      }
    };

    return () => {
      cancelled = true;
      maskCanvasRef.current = null;
      maskContextRef.current = null;
    };
  }, []);

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
    if (!dragRef.current.dragging && deltaX * deltaX + deltaY * deltaY > 25) {
      dragRef.current.dragging = true;
    }

    if (dragRef.current.dragging) {
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
        <img ref={imageRef} src={mascotImage} alt="" className="avatar-dock-image" draggable={false} />
      </button>
    </div>
  );
}
