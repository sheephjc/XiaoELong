import { useEffect, useState } from "react";
import {
  DEITY_CATALOG,
  DEITY_RANKS,
  getDeityRankLabel,
  type DeityId,
  type DeityStatus,
  type DeityWorshipResponse,
  type DeityWorshipTodayResponse
} from "@xiaoelong/shared";
import { getDeityRankVisuals } from "../deity-rank-visuals";
import EnergyWing from "./EnergyWing";
import aImage from "../assets/deities/a.jpg";
import chiliImage from "../assets/deities/chili.jpg";
import chuiImage from "../assets/deities/chui.jpg";
import daimengHfImage from "../assets/deities/daimeng-hf.jpg";
import guoImage from "../assets/deities/guo.jpg";
import huImage from "../assets/deities/hu.jpg";
import mxImage from "../assets/deities/mx.jpg";

interface DivineSelectionPanelProps {
  data: DeityWorshipTodayResponse | null;
  loading: boolean;
  error: string | null;
}

interface FullScreenDivineSelectionProps {
  data: DeityWorshipTodayResponse | null;
  loading: boolean;
  error: string | null;
  submittingDeityId: DeityId | null;
  onWorship: (deityId: DeityId) => Promise<DeityWorshipResponse | null>;
  onClose: (completed: boolean) => void;
}

type ConstellationMode = "compact" | "full";

const DEITY_IMAGES: Record<DeityId, string> = {
  hu: huImage,
  chui: chuiImage,
  a: aImage,
  mx: mxImage,
  guo: guoImage,
  chili: chiliImage,
  daimeng_hf: daimengHfImage
};

const DEITY_MOTIFS: Record<DeityId, string> = {
  hu: "🦌",
  chui: "◇",
  a: "☀",
  mx: "⌘",
  guo: "✦",
  chili: "🌶",
  daimeng_hf: "ฅ"
};

const DEITY_PARTICLES: Record<DeityId, string> = {
  hu: "🦌",
  chui: "🃏",
  a: "🥜",
  mx: "💻",
  guo: "✦",
  chili: "🌶️",
  daimeng_hf: "🐾"
};

interface GalaxyStar {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  warm: boolean;
  clustered: boolean;
}

function createGalaxyStars(): GalaxyStar[] {
  let seed = 0x51a7c3;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const clusterCoordinate = (center: number, spread: number): number => {
    const offset = (random() + random() + random()) / 3 - 0.5;
    return Math.max(1, Math.min(99, center + offset * spread * 2));
  };

  return Array.from({ length: 96 }, (_, index) => {
    const clustered = index >= 48;
    let x: number;
    let y: number;
    if (index < 48) {
      x = random() * 98 + 1;
      y = random() * 96 + 2;
    } else if (index < 74) {
      x = clusterCoordinate(28, 21);
      y = clusterCoordinate(37, 15);
    } else {
      x = clusterCoordinate(69, 24);
      y = clusterCoordinate(62, 17);
    }

    const sizeRoll = random();
    return {
      x,
      y,
      size: (sizeRoll > 0.94 ? 4.2 : sizeRoll > 0.72 ? 2.4 : 1.3) + (clustered ? 0.25 : 0),
      opacity: (clustered ? 0.48 : 0.3) + random() * (clustered ? 0.48 : 0.54),
      delay: -random() * 5.8,
      duration: 2.4 + random() * 4.6,
      warm: random() > 0.83,
      clustered
    };
  });
}

const GALAXY_STARS = createGalaxyStars();

// 北斗七星按天枢至瑶光排布。胡神固定在天璇，其余神沿星链展开。
// y 使用 0–70 的 SVG 坐标，渲染时换算为百分比。
const BIG_DIPPER_POSITIONS: Record<DeityId, { x: number; y: number; starName: string }> = {
  hu: { x: 30, y: 10, starName: "天璇" },
  chui: { x: 12, y: 19, starName: "天枢" },
  a: { x: 50, y: 16, starName: "天玑" },
  mx: { x: 29, y: 35, starName: "天权" },
  guo: { x: 46, y: 47, starName: "玉衡" },
  chili: { x: 65, y: 58, starName: "开阳" },
  daimeng_hf: { x: 87, y: 61, starName: "瑶光" }
};

// 全屏模式按真实北斗七星比例展开，形成左上斗身与向右下延伸的斗柄。
const FULL_BIG_DIPPER_POSITIONS: Record<DeityId, { x: number; y: number; starName: string }> = {
  hu: { x: 30, y: 8, starName: "天璇" },
  chui: { x: 14, y: 22, starName: "天枢" },
  a: { x: 48, y: 27, starName: "天玑" },
  mx: { x: 38, y: 48, starName: "天权" },
  guo: { x: 54, y: 63, starName: "玉衡" },
  chili: { x: 70, y: 79, starName: "开阳" },
  daimeng_hf: { x: 91, y: 86, starName: "瑶光" }
};

function fallbackStatus(deityId: DeityId): DeityStatus {
  return {
    deityId,
    totalWorships: 0,
    rank: "mortal",
    nextThreshold: 2
  };
}

function getRankProgress(status: DeityStatus): number {
  const rank = DEITY_RANKS.find((item) => item.id === status.rank);
  if (!rank || rank.nextThreshold === null) {
    return 100;
  }
  return Math.max(
    0,
    Math.min(100, ((status.totalWorships - rank.minimum) / (rank.nextThreshold - rank.minimum)) * 100)
  );
}

export function ConstellationMap(props: {
  data: DeityWorshipTodayResponse;
  mode: ConstellationMode;
  submittingDeityId?: DeityId | null;
  onWorship?: (deityId: DeityId) => Promise<void>;
}): JSX.Element {
  const todayDeityId = props.data.todayWorship?.deityId ?? null;
  const positions = props.mode === "full" ? FULL_BIG_DIPPER_POSITIONS : BIG_DIPPER_POSITIONS;
  const constellationPoints = props.mode === "full"
    ? "14,22 30,8 48,27 38,48 54,63 70,79 91,86"
    : "12,19 30,10 50,16 29,35 46,47 65,58 87,61";

  return (
    <div className={`constellation-map constellation-${props.mode}`}>
      <svg
        className="constellation-lines"
        viewBox={`0 0 100 ${props.mode === "full" ? 100 : 70}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline points={constellationPoints} />
      </svg>

      {DEITY_CATALOG.map((deity) => {
        const position = positions[deity.id];
        const status = props.data.deities.find((item) => item.deityId === deity.id) ?? fallbackStatus(deity.id);
        const progress = getRankProgress(status);
        const isToday = todayDeityId === deity.id;
        const disabled = props.submittingDeityId !== null || todayDeityId !== null;
        const rankVisuals = getDeityRankVisuals(status.rank);

        return (
          <div
            key={deity.id}
            className={`constellation-node deity-${deity.id.replace("_", "-")} rank-${status.rank} ${isToday ? "is-today-deity" : ""}`}
            style={{
              left: `${position.x}%`,
              top: props.mode === "full" ? `${position.y}%` : `${(position.y / 70) * 100}%`
            }}
          >
            <div className="deity-throne">
              <span className="throne-light-column" aria-hidden="true" />
              {props.mode === "full" && rankVisuals.showEnergyWings ? (
                <span className="throne-wings" aria-hidden="true">
                  <EnergyWing deityId={deity.id} enhanced className="throne-energy-wing" />
                </span>
              ) : null}
              <span className="throne-halo" aria-hidden="true" />
              <span className="throne-rune-arch" aria-hidden="true">
                {DEITY_MOTIFS[deity.id]} · {DEITY_MOTIFS[deity.id]} · {DEITY_MOTIFS[deity.id]}
              </span>
              <span className="throne-crown" aria-hidden="true">♛</span>
              <span className="throne-arm throne-arm-left" aria-hidden="true" />
              <span className="throne-arm throne-arm-right" aria-hidden="true" />
              <span className="throne-seat" aria-hidden="true" />
              {rankVisuals.showParticles
                ? Array.from({ length: 7 }, (_, particleIndex) => (
                    <span
                      key={particleIndex}
                      className={`throne-particle throne-particle-${particleIndex + 1}`}
                      aria-hidden="true"
                    >
                      {DEITY_PARTICLES[deity.id]}
                    </span>
                  ))
                : null}
              <div className="throne-portrait-shell">
                <img src={DEITY_IMAGES[deity.id]} alt={`${deity.name}神像`} />
              </div>
              <div
                className={`throne-identity ${rankVisuals.useIdentityPlate
                  ? "throne-identity--plate"
                  : "throne-identity--plain"}`}
              >
                <strong>{deity.name}</strong>
                <span>{getDeityRankLabel(status.rank)}</span>
              </div>
              <span className="throne-base" aria-hidden="true" />
            </div>

            {props.mode === "full" ? (
              <div className="throne-action-dock">
                <div className="throne-progress" aria-label={`${deity.name}晋升进度 ${Math.round(progress)}%`}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <button
                  type="button"
                  className="throne-worship-button"
                  disabled={disabled}
                  aria-label={`膜拜${deity.name}`}
                  onClick={() => void props.onWorship?.(deity.id)}
                >
                  <span aria-hidden="true">✦</span>
                  {isToday ? "今日已选" : props.submittingDeityId === deity.id ? "祈愿中…" : "膜拜"}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BlessingLayer(props: { result: DeityWorshipResponse; onAccept: () => void }): JSX.Element {
  const definition = DEITY_CATALOG.find((deity) => deity.id === props.result.deity.deityId);
  const blessingLength = Array.from(props.result.blessing).length;
  const decreeLengthClass = blessingLength > 40
    ? "blessing-decree--long"
    : blessingLength > 28
      ? "blessing-decree--medium"
      : "";
  return (
    <div
      className={`divine-blessing-overlay deity-${props.result.deity.deityId.replace("_", "-")} rank-${props.result.deity.rank} ${props.result.rankAdvanced ? "is-promotion" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="divine-blessing-title"
    >
      <div className="blessing-burst" aria-hidden="true">
        {Array.from({ length: props.result.rankAdvanced ? 18 : 10 }, (_, index) => (
          <span key={index} className={`blessing-particle blessing-particle-${(index % 9) + 1}`} />
        ))}
      </div>
      <div className="divine-blessing-card">
        {props.result.rankAdvanced ? <div className="divine-promotion-badge">神位晋升</div> : null}
        <div className="blessing-portrait-shell">
          <img src={DEITY_IMAGES[props.result.deity.deityId]} alt={`${definition?.name ?? "神明"}神像`} />
          <span aria-hidden="true">✦</span>
        </div>
        <p className="blessing-source">{definition?.name ?? "神明"}权柄</p>
        <h2 id="divine-blessing-title">神赐权柄</h2>
        <div className="blessing-divider" aria-hidden="true"><span>✦</span></div>
        <p className={`blessing-decree ${decreeLengthClass}`}>{props.result.blessing}</p>
        <button type="button" onClick={props.onAccept}>
          <span aria-hidden="true">✦</span>
          领受
          <span aria-hidden="true">✦</span>
        </button>
      </div>
    </div>
  );
}

export function DivineSelectionPanel(props: DivineSelectionPanelProps): JSX.Element {
  const canOpenLargePreview = import.meta.env.DEV && Boolean(window.xiaoelongDesktop?.openDivineSelection);
  const [largePreviewState, setLargePreviewState] = useState<"idle" | "opening" | "error">("idle");

  async function handleOpenLargePreview(): Promise<void> {
    if (!window.xiaoelongDesktop?.openDivineSelection || largePreviewState === "opening") {
      return;
    }
    setLargePreviewState("opening");
    try {
      const result = await window.xiaoelongDesktop.openDivineSelection(props.data);
      setLargePreviewState(result.ok ? "idle" : "error");
    } catch {
      setLargePreviewState("error");
    }
  }

  return (
    <section className="divine-panel divine-compact-panel" aria-label="神选北斗星图">
      {canOpenLargePreview ? (
        <button
          type="button"
          className="divine-dev-large-button"
          disabled={largePreviewState === "opening"}
          onClick={() => void handleOpenLargePreview()}
        >
          <span className="divine-dev-large-button-star" aria-hidden="true">✦</span>
          <span>
            {largePreviewState === "opening" ? "汇聚中…" : largePreviewState === "error" ? "重试汇聚" : "星轨汇聚"}
          </span>
        </button>
      ) : null}
      <div className="divine-panel-content">
        {props.error ? <div className="divine-error" role="alert">{props.error}</div> : null}
        {props.loading && !props.data ? <div className="divine-loading">北斗神位正在显现…</div> : null}
        {props.data ? <ConstellationMap data={props.data} mode="compact" /> : null}
      </div>
    </section>
  );
}

export function FullScreenDivineSelection(props: FullScreenDivineSelectionProps): JSX.Element {
  const [blessingResult, setBlessingResult] = useState<DeityWorshipResponse | null>(null);
  const [showDelayedLoading, setShowDelayedLoading] = useState(false);
  const alreadyCompleted = props.data?.todayWorship !== null && props.data?.todayWorship !== undefined;

  useEffect(() => {
    if (!props.loading || props.data) {
      setShowDelayedLoading(false);
      return;
    }

    const timer = window.setTimeout(() => setShowDelayedLoading(true), 650);
    return () => window.clearTimeout(timer);
  }, [props.data, props.loading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        props.onClose(Boolean(blessingResult || alreadyCompleted));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alreadyCompleted, blessingResult, props]);

  async function handleWorship(deityId: DeityId): Promise<void> {
    const result = await props.onWorship(deityId);
    if (result) {
      setBlessingResult(result);
    }
  }

  function handleBlessingAccept(): void {
    setBlessingResult(null);
    props.onClose(true);
  }

  return (
    <main className="divine-stage">
      <div className="divine-stage-stars" aria-hidden="true">
        {GALAXY_STARS.map((star, index) => (
          <span
            className={star.size >= 4 ? "is-bright" : undefined}
            key={index}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              background: star.warm ? "rgba(255, 232, 178, 0.9)" : "rgba(222, 239, 255, 0.9)",
              boxShadow: star.warm
                ? `0 0 ${star.clustered ? 11 : 7}px rgba(255, 219, 148, 0.76)`
                : `0 0 ${star.clustered ? 11 : 7}px rgba(157, 204, 255, 0.74)`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`
            }}
          />
        ))}
      </div>
      <h1 className="divine-stage-title">
        <span aria-hidden="true">✦</span>
        七星御天
        <span aria-hidden="true">✦</span>
      </h1>
      <button
        type="button"
        className="divine-stage-close"
        aria-label="退出北斗神阵"
        onClick={() => props.onClose(Boolean(blessingResult || alreadyCompleted))}
      >
        ×
      </button>

      {props.error ? <div className="divine-stage-error" role="alert">{props.error}</div> : null}
      {showDelayedLoading ? <div className="divine-stage-loading">星轨正在汇聚…</div> : null}
      {props.data ? (
        <ConstellationMap
          data={props.data}
          mode="full"
          submittingDeityId={props.submittingDeityId}
          onWorship={handleWorship}
        />
      ) : null}

      {blessingResult ? <BlessingLayer result={blessingResult} onAccept={handleBlessingAccept} /> : null}
    </main>
  );
}
