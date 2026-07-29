import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import {
  PET_ANIMATION_MANIFEST,
  resolvePetRenderScale,
  shouldUseStaticPetFrame,
  type PetAnimationState,
  type PetDisplayMode
} from "../pet-animation";

const HIT_ALPHA_THRESHOLD = 32;
const SPRITE_SHEET_URL = `${import.meta.env.BASE_URL}xiaoelong-pet-spritesheet.webp`;
const DISPLAY_WIDTH = 156;
const DISPLAY_HEIGHT = 169;

export interface PetSpriteHandle {
  isOpaqueAt: (clientX: number, clientY: number) => boolean;
}

interface PetSpriteProps {
  animation: PetAnimationState;
  displayMode: PetDisplayMode;
  fallbackImageUrl: string;
  fallbackMaskUrl: string;
  onAnimationComplete: () => void;
  onFrameRendered?: () => void;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) {
      return;
    }
    const handleChange = (): void => setReduced(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}

function usePetRenderScale(): number {
  const [scale, setScale] = useState(() => resolvePetRenderScale(window.devicePixelRatio));

  useEffect(() => {
    let resolutionQuery: MediaQueryList | null = null;

    function handleScaleChange(): void {
      resolutionQuery?.removeEventListener("change", handleScaleChange);
      setScale(resolvePetRenderScale(window.devicePixelRatio));
      resolutionQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`) ?? null;
      resolutionQuery?.addEventListener("change", handleScaleChange);
    }

    handleScaleChange();
    window.addEventListener("resize", handleScaleChange);
    return () => {
      window.removeEventListener("resize", handleScaleChange);
      resolutionQuery?.removeEventListener("change", handleScaleChange);
    };
  }, []);

  return scale;
}

function pointToPixel(clientX: number, clientY: number, rect: DOMRect, width: number, height: number): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  return {
    x: Math.min(width - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * width))),
    y: Math.min(height - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * height)))
  };
}

export const PetSprite = forwardRef<PetSpriteHandle, PetSpriteProps>(function PetSprite(props, ref): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackImageRef = useRef<HTMLImageElement | null>(null);
  const fallbackMaskRef = useRef<HTMLCanvasElement | null>(null);
  const atlasImageRef = useRef<HTMLImageElement | null>(null);
  const completeCallbackRef = useRef(props.onAnimationComplete);
  const frameCallbackRef = useRef(props.onFrameRendered);
  const [atlasReady, setAtlasReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const renderScale = usePetRenderScale();

  completeCallbackRef.current = props.onAnimationComplete;
  frameCallbackRef.current = props.onFrameRendered;

  useEffect(() => {
    if (props.displayMode === "image") {
      atlasImageRef.current = null;
      setAtlasReady(false);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) {
        return;
      }
      if (
        image.naturalWidth !== PET_ANIMATION_MANIFEST.columns * PET_ANIMATION_MANIFEST.cellWidth ||
        image.naturalHeight !== PET_ANIMATION_MANIFEST.rows * PET_ANIMATION_MANIFEST.cellHeight
      ) {
        atlasImageRef.current = null;
        setAtlasReady(false);
        return;
      }
      atlasImageRef.current = image;
      setAtlasReady(true);
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      atlasImageRef.current = null;
      setAtlasReady(false);
    };
    image.src = SPRITE_SHEET_URL;
    return () => {
      cancelled = true;
      atlasImageRef.current = null;
    };
  }, [props.displayMode]);

  useEffect(() => {
    let cancelled = false;
    const maskImage = new Image();
    maskImage.onload = () => {
      if (cancelled) {
        return;
      }
      const mask = document.createElement("canvas");
      mask.width = maskImage.naturalWidth;
      mask.height = maskImage.naturalHeight;
      const context = mask.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return;
      }
      context.drawImage(maskImage, 0, 0);
      fallbackMaskRef.current = mask;
      frameCallbackRef.current?.();
    };
    maskImage.src = props.fallbackMaskUrl;
    return () => {
      cancelled = true;
      fallbackMaskRef.current = null;
    };
  }, [props.fallbackMaskUrl]);

  const drawFrame = useCallback((animation: PetAnimationState, frameIndex: number): void => {
    const canvas = canvasRef.current;
    const atlas = atlasImageRef.current;
    if (!canvas || !atlas) {
      return;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }
    const definition = PET_ANIMATION_MANIFEST.animations[animation];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      atlas,
      frameIndex * PET_ANIMATION_MANIFEST.cellWidth,
      definition.row * PET_ANIMATION_MANIFEST.cellHeight,
      PET_ANIMATION_MANIFEST.cellWidth,
      PET_ANIMATION_MANIFEST.cellHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    frameCallbackRef.current?.();
  }, []);

  useEffect(() => {
    if (!atlasReady || props.displayMode === "image") {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const definition = PET_ANIMATION_MANIFEST.animations[props.animation];
    const frameDuration = 1000 / definition.fps;

    if (shouldUseStaticPetFrame(props.displayMode, reducedMotion)) {
      drawFrame(props.animation, definition.reducedMotionFrame);
      if (definition.loops !== null) {
        timer = window.setTimeout(() => completeCallbackRef.current(), definition.reducedMotionDurationMs ?? 1200);
      }
      return () => {
        cancelled = true;
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      };
    }

    let frameIndex = 0;
    let completedLoops = 0;
    drawFrame(props.animation, frameIndex);

    const advance = (): void => {
      if (cancelled) {
        return;
      }
      if (document.hidden) {
        timer = window.setTimeout(advance, 100);
        return;
      }

      frameIndex += 1;
      if (frameIndex >= definition.frames) {
        completedLoops += 1;
        if (definition.loops !== null && completedLoops >= definition.loops) {
          completeCallbackRef.current();
          return;
        }
        frameIndex = 0;
      }
      drawFrame(props.animation, frameIndex);
      timer = window.setTimeout(advance, frameDuration);
    };

    timer = window.setTimeout(advance, frameDuration);
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [atlasReady, drawFrame, props.animation, props.displayMode, reducedMotion, renderScale]);

  useImperativeHandle(ref, () => ({
    isOpaqueAt(clientX: number, clientY: number): boolean {
      if (atlasReady && props.displayMode !== "image") {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !context) {
          return true;
        }
        const point = pointToPixel(clientX, clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
        return point ? context.getImageData(point.x, point.y, 1, 1).data[3] > HIT_ALPHA_THRESHOLD : false;
      }

      const image = fallbackImageRef.current;
      const mask = fallbackMaskRef.current;
      const context = mask?.getContext("2d", { willReadFrequently: true });
      if (!image || !mask || !context) {
        return true;
      }
      const rect = image.getBoundingClientRect();
      const scale = Math.min(rect.width / mask.width, rect.height / mask.height);
      const renderedWidth = mask.width * scale;
      const renderedHeight = mask.height * scale;
      const renderedRect = new DOMRect(
        rect.left + (rect.width - renderedWidth) / 2,
        rect.top + (rect.height - renderedHeight) / 2,
        renderedWidth,
        renderedHeight
      );
      const point = pointToPixel(clientX, clientY, renderedRect, mask.width, mask.height);
      return point ? context.getImageData(point.x, point.y, 1, 1).data[3] > HIT_ALPHA_THRESHOLD : false;
    }
  }), [atlasReady, props.displayMode]);

  const showAtlas = atlasReady && props.displayMode !== "image";

  return (
    <span className={`pet-sprite ${props.displayMode === "image" ? "image-only" : ""}`} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className={`pet-sprite-canvas ${showAtlas ? "" : "hidden"}`}
        width={Math.round(DISPLAY_WIDTH * renderScale)}
        height={Math.round(DISPLAY_HEIGHT * renderScale)}
      />
      <img
        ref={fallbackImageRef}
        src={props.fallbackImageUrl}
        alt=""
        className={`avatar-dock-image pet-sprite-fallback ${showAtlas ? "hidden" : ""}`}
        draggable={false}
      />
    </span>
  );
});
