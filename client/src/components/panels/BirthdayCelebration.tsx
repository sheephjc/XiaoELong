import type { BirthdayCelebration as BirthdayCelebrationData } from "../../utils/birthday-celebration";

interface BirthdayCelebrationProps {
  celebration: BirthdayCelebrationData;
  dialogOpen: boolean;
  onCloseDialog: () => void;
}

const CONFETTI_PIECES = Array.from({ length: 14 }, (_, index) => index);
const MINI_CONFETTI_PIECES = Array.from({ length: 7 }, (_, index) => index);
const PANEL_RIBBONS = Array.from({ length: 18 }, (_, index) => index);
const PANEL_CAKES = Array.from({ length: 5 }, (_, index) => index);
const PANEL_FIREWORKS = Array.from({ length: 3 }, (_, index) => index);
const FIREWORK_PARTICLES = Array.from({ length: 10 }, (_, index) => index);

function BirthdayBanner({ celebration }: { celebration: BirthdayCelebrationData }): JSX.Element {
  const names = celebration.celebrants.map((celebrant) => celebrant.name).join("、");

  return (
    <div className="birthday-celebration-banner" role="status" aria-label={celebration.greeting}>
      <span className="birthday-banner-cake" aria-hidden="true">🎂</span>
      <span className="birthday-banner-copy">
        <strong>{names}，生日快乐！</strong>
        <small>HAPPY BIRTHDAY</small>
      </span>
      <span className="birthday-banner-party" aria-hidden="true">🥳</span>
      <span className="birthday-mini-confetti" aria-hidden="true">
        {MINI_CONFETTI_PIECES.map((piece) => <i key={piece} />)}
      </span>
    </div>
  );
}

function BirthdayPanelEffects(): JSX.Element {
  return (
    <div className="birthday-panel-effects" aria-hidden="true">
      <span className="birthday-panel-ribbons">
        {PANEL_RIBBONS.map((piece) => <i key={piece} />)}
      </span>
      <span className="birthday-panel-cakes">
        {PANEL_CAKES.map((cake) => <i key={cake}>🎂</i>)}
      </span>
      <span className="birthday-panel-fireworks">
        {PANEL_FIREWORKS.map((firework) => (
          <i className={`birthday-panel-firework birthday-panel-firework-${firework + 1}`} key={firework}>
            {FIREWORK_PARTICLES.map((particle) => <b key={particle} />)}
          </i>
        ))}
      </span>
    </div>
  );
}

function BirthdayDialog({
  celebration,
  onClose
}: {
  celebration: BirthdayCelebrationData;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="birthday-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-label={celebration.greeting}
    >
      <div className="birthday-dialog-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((piece) => <i key={piece} />)}
      </div>

      <section className="birthday-dialog-card">
        <button
          type="button"
          className="birthday-dialog-close"
          aria-label="关闭生日祝福"
          onClick={onClose}
        />
        <span className="birthday-dialog-balloon birthday-dialog-balloon-left" aria-hidden="true">🎈</span>
        <span className="birthday-dialog-balloon birthday-dialog-balloon-right" aria-hidden="true">🎈</span>

        <div className="birthday-dialog-emblem" aria-hidden="true">
          <span>🎂</span>
        </div>
        <p className="birthday-dialog-eyebrow">小鳄龙之家 · 生日特别放送</p>
        <h2>{celebration.greeting}</h2>
        <p className="birthday-dialog-wish">
          愿新的一岁天天开心、好运常在，<br />想做的事都闪闪发光！
        </p>
        <span className="birthday-dialog-date">
          {celebration.month} 月 {celebration.day} 日
        </span>
        <button type="button" className="birthday-dialog-accept" onClick={onClose}>
          开心收下 🎉
        </button>
      </section>
    </div>
  );
}

export function BirthdayCelebration({
  celebration,
  dialogOpen,
  onCloseDialog
}: BirthdayCelebrationProps): JSX.Element {
  return (
    <>
      <BirthdayBanner celebration={celebration} />
      <BirthdayPanelEffects />
      {dialogOpen ? <BirthdayDialog celebration={celebration} onClose={onCloseDialog} /> : null}
    </>
  );
}
