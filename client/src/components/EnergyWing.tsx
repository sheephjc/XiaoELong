import { useId, type CSSProperties } from "react";
import type { DeityId } from "@xiaoelong/shared";
import "./EnergyWing.css";

export interface EnergyWingProps {
  deityId: DeityId;
  enhanced?: boolean;
  className?: string;
}

interface WingPalette {
  primary: string;
  secondary: string;
  deep: string;
  soft: string;
}

const WING_PALETTES: Record<DeityId, WingPalette> = {
  hu: { primary: "#2eb6c5", secondary: "#63e6be", deep: "#167286", soft: "#e2fafd" },
  chui: { primary: "#7689d5", secondary: "#b8c4ff", deep: "#4a58a2", soft: "#edf0ff" },
  a: { primary: "#e19842", secondary: "#ffd166", deep: "#9e5f24", soft: "#fff3da" },
  mx: { primary: "#438dde", secondary: "#67e8f9", deep: "#245a9a", soft: "#e5f3ff" },
  guo: { primary: "#d35ca7", secondary: "#ff8ccf", deep: "#8c326e", soft: "#ffe8f6" },
  chili: { primary: "#ec5f49", secondary: "#ffb347", deep: "#a52f27", soft: "#ffebe4" },
  daimeng_hf: { primary: "#b06dc7", secondary: "#e4a8ff", deep: "#6d3e83", soft: "#f8eaff" }
};

const MAIN_FEATHERS = [
  "M505 382 C438 332 374 263 315 178 C271 114 248 61 263 28 C299 75 312 136 346 191 C394 270 456 326 505 382 Z",
  "M497 395 C407 364 315 305 210 229 C148 185 99 157 64 166 C105 222 164 265 231 301 C337 359 428 384 497 395 Z",
  "M498 411 C391 405 285 382 159 340 C102 321 60 315 32 329 C83 369 150 390 222 402 C334 421 424 417 498 411 Z",
  "M503 426 C405 445 304 474 189 531 C128 561 87 588 72 618 C137 612 199 585 258 550 C351 495 432 453 503 426 Z",
  "M511 438 C435 477 360 529 282 600 C237 641 211 676 210 706 C270 680 320 638 363 591 C429 520 475 475 511 438 Z",
  "M495 420 C427 421 361 430 288 455 C241 471 207 489 193 510 C241 508 291 494 337 475 C403 447 456 431 495 420 Z"
] as const;

const MAIN_HIGHLIGHTS = [
  "M487 374 C409 296 333 184 275 70",
  "M479 392 C371 348 228 269 100 187",
  "M480 409 C356 405 198 371 73 335",
  "M487 430 C366 466 218 543 107 603",
  "M497 445 C412 512 320 617 232 686"
] as const;

const INNER_FEATHERS = [
  "M520 397 C486 344 464 290 456 233 C482 268 503 314 520 397 Z",
  "M515 411 C460 379 418 343 385 295 C432 320 480 360 515 411 Z",
  "M519 424 C455 419 407 405 358 379 C413 384 474 399 519 424 Z",
  "M526 434 C470 449 428 469 387 504 C428 492 482 467 526 434 Z"
] as const;

const INNER_HIGHLIGHTS = [
  "M521 403 Q461 346 422 276",
  "M518 418 Q447 394 386 350",
  "M523 431 Q458 447 405 479"
] as const;

const ENERGY_THREADS = [
  "M526 420 C429 379 329 286 236 182",
  "M526 426 C409 430 281 422 145 380",
  "M526 433 C424 466 329 526 248 604"
] as const;

const FRAGMENTS = [
  "M151 628 L176 615 L166 647 L142 659 Z",
  "M93 673 L121 655 L108 687 L83 699 Z",
  "M227 653 L247 643 L240 667 L220 678 Z",
  "M76 392 L108 384 L94 405 L61 413 Z",
  "M184 296 L211 297 L197 312 L171 311 Z",
  "M361 177 L373 192 L360 211 L350 190 Z",
  "M305 690 L315 681 L320 697 L311 708 Z"
] as const;

const SPARKS = [
  { cx: 132, cy: 552, r: 3 },
  { cx: 254, cy: 342, r: 2.4 },
  { cx: 332, cy: 596, r: 2.2 },
  { cx: 419, cy: 252, r: 2 }
] as const;

type EnergyWingStyle = CSSProperties & {
  "--energy-wing-primary": string;
  "--energy-wing-secondary": string;
};

export default function EnergyWing(props: EnergyWingProps): JSX.Element {
  const { deityId, enhanced = false, className = "" } = props;
  const palette = WING_PALETTES[deityId];
  const uid = useId().replace(/:/g, "");
  const ids = {
    main: `${uid}-energy-main`,
    edge: `${uid}-energy-edge`,
    inner: `${uid}-energy-inner`,
    crystal: `${uid}-energy-crystal`,
    halo: `${uid}-energy-halo`,
    wingBase: `${uid}-energy-wing-base`
  };
  const classes = [
    "energy-wing-effect",
    enhanced ? "energy-wing-effect--enhanced" : "",
    className
  ].filter(Boolean).join(" ");
  const style: EnergyWingStyle = {
    "--energy-wing-primary": palette.primary,
    "--energy-wing-secondary": palette.secondary
  };

  return (
    <svg
      aria-hidden="true"
      className={classes}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      style={style}
      viewBox="0 0 1200 760"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={ids.main} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={palette.deep} stopOpacity="0.28" />
          <stop offset="0.32" stopColor={palette.primary} stopOpacity="0.9" />
          <stop offset="0.68" stopColor={palette.secondary} />
          <stop offset="1" stopColor={palette.soft} />
        </linearGradient>
        <linearGradient id={ids.edge} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={palette.deep} stopOpacity="0.72" />
          <stop offset="0.28" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.soft} />
        </linearGradient>
        <linearGradient id={ids.inner} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={palette.deep} stopOpacity="0.34" />
          <stop offset="0.4" stopColor={palette.primary} stopOpacity="0.9" />
          <stop offset="1" stopColor={palette.secondary} />
        </linearGradient>
        <linearGradient id={ids.crystal} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={palette.deep} />
          <stop offset="0.48" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.secondary} />
        </linearGradient>
        <radialGradient id={ids.halo}>
          <stop offset="0.72" stopColor={palette.primary} stopOpacity="0" />
          <stop offset="0.9" stopColor={palette.secondary} stopOpacity="0.18" />
          <stop offset="1" stopColor={palette.soft} stopOpacity="0.48" />
        </radialGradient>

        <g id={ids.wingBase}>
          <g
            className="energy-wing-effect__main-feathers"
            fill={`url(#${ids.main})`}
            stroke={`url(#${ids.edge})`}
            strokeWidth="2"
            strokeLinejoin="round"
          >
            {MAIN_FEATHERS.map((d, index) => <path d={d} key={d} opacity={index === 5 ? 0.9 : undefined} />)}
          </g>
          <g fill="none" stroke={palette.soft} strokeWidth="3" strokeLinecap="round" opacity="0.54">
            {MAIN_HIGHLIGHTS.map((d) => <path d={d} key={d} />)}
          </g>

          <g
            className="energy-wing-effect__inner-feathers"
            fill={`url(#${ids.inner})`}
            stroke={palette.secondary}
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            {INNER_FEATHERS.map((d) => <path d={d} key={d} />)}
          </g>
          <g fill="none" stroke={palette.primary} strokeWidth="3" strokeLinecap="round" opacity="0.74">
            {INNER_HIGHLIGHTS.map((d) => <path d={d} key={d} />)}
          </g>

          <g fill="none" strokeLinecap="round" opacity="0.64">
            <path d={ENERGY_THREADS[0]} stroke={palette.secondary} strokeWidth="2" />
            <path d={ENERGY_THREADS[1]} stroke={palette.primary} strokeWidth="1.7" />
            <path d={ENERGY_THREADS[2]} stroke={palette.soft} strokeWidth="1.5" />
          </g>

          <g fill={`url(#${ids.crystal})`} stroke={palette.soft} strokeWidth="1">
            {FRAGMENTS.map((d, index) => (
              <path className={`energy-wing-effect__fragment energy-wing-effect__fragment--${index + 1}`} d={d} key={d} />
            ))}
          </g>
          <g fill={palette.soft}>
            {SPARKS.map((spark, index) => (
              <circle
                className={`energy-wing-effect__spark energy-wing-effect__spark--${index + 1}`}
                cx={spark.cx}
                cy={spark.cy}
                key={`${spark.cx}-${spark.cy}`}
                r={spark.r}
              />
            ))}
          </g>
        </g>
      </defs>

      <circle
        className="energy-wing-effect__halo"
        cx="600"
        cy="400"
        r="276"
        fill="none"
        stroke={`url(#${ids.halo})`}
        strokeWidth="12"
        opacity="0.62"
      />
      <circle cx="600" cy="400" r="267" fill="none" stroke={palette.soft} strokeWidth="1.5" opacity="0.2" />

      <g className="energy-wing-effect__wing-motion">
        <use href={`#${ids.wingBase}`} />
      </g>
      <g transform="translate(1200 0) scale(-1 1)">
        <g className="energy-wing-effect__wing-motion">
          <use href={`#${ids.wingBase}`} />
        </g>
      </g>
    </svg>
  );
}
