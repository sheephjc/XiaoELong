import { memo } from "react";
import type {
  DailyQuestionResult,
  DailyQuestionStats,
  DailyQuestionTodayResponse,
  DailyQuestionVisual,
  DailyQuestionVoter
} from "@xiaoelong/shared";
import { UserAvatar } from "./UserAvatar";

interface DailyQuestionPanelProps {
  data: DailyQuestionTodayResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onAnswer: (answerIndex: number) => Promise<void>;
}

function getPercent(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((count / total) * 100);
}

function getChoiceLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function clampIndex(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

function clockPoint(cx: number, cy: number, length: number, angleDegrees: number): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + Math.sin(radians) * length,
    y: cy - Math.cos(radians) * length
  };
}

function ClockVisual(props: { visual: Extract<DailyQuestionVisual, { type: "clock" }> }): JSX.Element {
  const { hour, minute } = props.visual.data;
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  const hourPoint = clockPoint(180, 112, 48, hourAngle);
  const minutePoint = clockPoint(180, 112, 70, minuteAngle);
  const labels = [
    [180, 34, "12"],
    [258, 112, "3"],
    [180, 190, "6"],
    [102, 112, "9"]
  ] as const;

  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="钟表附图">
      <circle cx="180" cy="112" r="88" className="visual-surface" />
      <circle cx="180" cy="112" r="72" className="visual-guide" />
      {labels.map(([x, y, label]) => (
        <text key={label} x={x} y={y} className="visual-label" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      ))}
      <line x1="180" y1="112" x2={minutePoint.x} y2={minutePoint.y} className="visual-hand minute" />
      <line x1="180" y1="112" x2={hourPoint.x} y2={hourPoint.y} className="visual-hand hour" />
      <circle cx="180" cy="112" r="7" className="visual-dot" />
    </svg>
  );
}

function Venn2Visual(props: { visual: Extract<DailyQuestionVisual, { type: "venn2" }> }): JSX.Element {
  const { leftLabel, rightLabel, leftOnly, both, rightOnly, outside } = props.visual.data;
  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="双集合韦恩图">
      <rect x="30" y="36" width="300" height="150" rx="12" className="visual-frame" />
      <circle cx="145" cy="112" r="72" className="visual-venn-left" />
      <circle cx="215" cy="112" r="72" className="visual-venn-right" />
      <text x="118" y="58" className="visual-label" textAnchor="middle">{leftLabel}</text>
      <text x="242" y="58" className="visual-label" textAnchor="middle">{rightLabel}</text>
      <text x="106" y="122" className="visual-number" textAnchor="middle">{leftOnly}</text>
      <text x="180" y="122" className="visual-number" textAnchor="middle">{both}</text>
      <text x="254" y="122" className="visual-number" textAnchor="middle">{rightOnly}</text>
      {outside !== undefined ? <text x="302" y="168" className="visual-number small" textAnchor="middle">{outside}</text> : null}
    </svg>
  );
}

function PathGridVisual(props: { visual: Extract<DailyQuestionVisual, { type: "pathGrid" }> }): JSX.Element {
  const rows = Math.max(2, Math.min(props.visual.data.rows, 5));
  const cols = Math.max(2, Math.min(props.visual.data.cols, 5));
  const size = Math.min(220 / (cols - 1), 130 / (rows - 1));
  const width = size * (cols - 1);
  const height = size * (rows - 1);
  const startX = (360 - width) / 2;
  const startY = 54;
  const [rawStartRow, rawStartCol] = props.visual.data.start;
  const [rawEndRow, rawEndCol] = props.visual.data.end;
  const startRow = clampIndex(rawStartRow, rows - 1);
  const startCol = clampIndex(rawStartCol, cols - 1);
  const endRow = clampIndex(rawEndRow, rows - 1);
  const endCol = clampIndex(rawEndCol, cols - 1);
  const canMoveRight = props.visual.data.allowedMoves.includes("right");
  const canMoveDown = props.visual.data.allowedMoves.includes("down");
  const moveText =
    canMoveRight && canMoveDown ? "只能向右或向下走" : canMoveRight ? "只能向右走" : "只能向下走";
  const point = (row: number, col: number) => ({
    x: startX + col * size,
    y: startY + row * size
  });
  const start = point(startRow, startCol);
  const end = point(endRow, endCol);

  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="路径网格图">
      {Array.from({ length: rows }, (_, row) => (
        <line key={`r-${row}`} x1={startX} y1={startY + row * size} x2={startX + width} y2={startY + row * size} className="visual-grid-line" />
      ))}
      {Array.from({ length: cols }, (_, col) => (
        <line key={`c-${col}`} x1={startX + col * size} y1={startY} x2={startX + col * size} y2={startY + height} className="visual-grid-line" />
      ))}
      <circle cx={start.x} cy={start.y} r="18" className="visual-start" />
      <circle cx={end.x} cy={end.y} r="18" className="visual-end" />
      <text x={start.x} y={start.y + 1} className="visual-point-label" textAnchor="middle" dominantBaseline="middle">A</text>
      <text x={end.x} y={end.y + 1} className="visual-point-label" textAnchor="middle" dominantBaseline="middle">B</text>
      <text x="180" y="196" className="visual-caption" textAnchor="middle">{moveText}</text>
    </svg>
  );
}

function BarChartVisual(props: { visual: Extract<DailyQuestionVisual, { type: "barChart" }> }): JSX.Element {
  const items = props.visual.data.items.slice(0, 5);
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const chartBottom = 174;
  const barWidth = 38;
  const gap = 20;
  const totalWidth = items.length * barWidth + (items.length - 1) * gap;
  const firstX = (360 - totalWidth) / 2;

  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="柱状图">
      {props.visual.data.title ? <text x="180" y="28" className="visual-label" textAnchor="middle">{props.visual.data.title}</text> : null}
      <line x1="54" y1={chartBottom} x2="306" y2={chartBottom} className="visual-axis" />
      {items.map((item, index) => {
        const height = Math.max(8, (item.value / maxValue) * 116);
        const x = firstX + index * (barWidth + gap);
        const y = chartBottom - height;
        return (
          <g key={item.label}>
            <rect x={x} y={y} width={barWidth} height={height} rx="8" className={`visual-bar tone-${index % 4}`} />
            <text x={x + barWidth / 2} y={y - 8} className="visual-value" textAnchor="middle">{item.value}</text>
            <text x={x + barWidth / 2} y="198" className="visual-label" textAnchor="middle">{item.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LogicTableVisual(props: { visual: Extract<DailyQuestionVisual, { type: "logicTable" }> }): JSX.Element {
  const people = props.visual.data.people.slice(0, 4);
  const roles = props.visual.data.roles.slice(0, 4);
  const cellWidth = 240 / Math.max(roles.length, 1);
  const cellHeight = 34;
  const tableY = 36;
  const tableWidth = 60 + roles.length * cellWidth;
  const tableX = (360 - tableWidth) / 2;

  function findMark(person: string, role: string): boolean | null {
    return props.visual.data.marks.find((mark) => mark.person === person && mark.role === role)?.value ?? null;
  }

  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="逻辑表格">
      <rect x={tableX} y={tableY} width={tableWidth} height={(people.length + 1) * cellHeight} rx="10" className="visual-frame" />
      {roles.map((role, index) => (
        <text key={role} x={tableX + 60 + index * cellWidth + cellWidth / 2} y={tableY + 22} className="visual-label" textAnchor="middle">
          {role}
        </text>
      ))}
      {people.map((person, row) => (
        <g key={person}>
          <text x={tableX + 30} y={tableY + (row + 1) * cellHeight + 22} className="visual-label" textAnchor="middle">{person}</text>
          {roles.map((role, col) => {
            const mark = findMark(person, role);
            return (
              <text key={`${person}-${role}`} x={tableX + 60 + col * cellWidth + cellWidth / 2} y={tableY + (row + 1) * cellHeight + 23} className={`visual-mark ${mark ? "yes" : "no"}`} textAnchor="middle">
                {mark === null ? "" : mark ? "✓" : "×"}
              </text>
            );
          })}
        </g>
      ))}
      {Array.from({ length: people.length + 2 }, (_, row) => (
        <line key={`row-${row}`} x1={tableX} y1={tableY + row * cellHeight} x2={tableX + tableWidth} y2={tableY + row * cellHeight} className="visual-table-line" />
      ))}
      {[tableX, tableX + 60, ...roles.map((_, index) => tableX + 60 + (index + 1) * cellWidth)].map((x) => (
        <line key={`col-${x}`} x1={x} y1={tableY} x2={x} y2={tableY + (people.length + 1) * cellHeight} className="visual-table-line" />
      ))}
    </svg>
  );
}

function TriangleVisual(props: { visual: Extract<DailyQuestionVisual, { type: "triangle" }> }): JSX.Element {
  const [a, b, c] = props.visual.data.points;
  const angleAtA = props.visual.data.angles?.find((angle) => angle.point === a)?.degrees;
  const unknownPoint = props.visual.data.unknownAngleAt;
  const hasSide = (first: string, second: string) =>
    props.visual.data.equalSides?.some(
      ([left, right]) => (left === first && right === second) || (left === second && right === first)
    ) ?? false;
  const unknownPositions: Record<string, { x: number; y: number }> = {
    [a]: { x: 180, y: 70 },
    [b]: { x: 112, y: 165 },
    [c]: { x: 248, y: 165 }
  };
  const unknownPosition = unknownPoint ? unknownPositions[unknownPoint] : null;

  return (
    <svg className="question-visual-svg" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="三角形图">
      <polygon points="180,32 82,178 278,178" className="visual-triangle" />
      <text x="180" y="22" className="visual-point-label" textAnchor="middle">{a}</text>
      <text x="64" y="198" className="visual-point-label" textAnchor="middle">{b}</text>
      <text x="296" y="198" className="visual-point-label" textAnchor="middle">{c}</text>
      {hasSide(a, b) ? <line x1="126" y1="109" x2="140" y2="118" className="visual-equal-mark" /> : null}
      {hasSide(a, c) ? <line x1="220" y1="118" x2="234" y2="109" className="visual-equal-mark" /> : null}
      {hasSide(b, c) ? <line x1="172" y1="171" x2="172" y2="185" className="visual-equal-mark" /> : null}
      {angleAtA ? <text x="180" y="70" className="visual-value" textAnchor="middle">{angleAtA}°</text> : null}
      {unknownPosition ? (
        <text x={unknownPosition.x} y={unknownPosition.y} className="visual-unknown" textAnchor="middle">
          ?
        </text>
      ) : null}
    </svg>
  );
}

function QuestionVisual(props: { visual: DailyQuestionVisual | null }): JSX.Element | null {
  if (!props.visual) {
    return null;
  }

  const visual = props.visual;
  return (
    <div className="question-visual">
      {visual.type === "clock" ? <ClockVisual visual={visual} /> : null}
      {visual.type === "venn2" ? <Venn2Visual visual={visual} /> : null}
      {visual.type === "pathGrid" ? <PathGridVisual visual={visual} /> : null}
      {visual.type === "barChart" ? <BarChartVisual visual={visual} /> : null}
      {visual.type === "logicTable" ? <LogicTableVisual visual={visual} /> : null}
      {visual.type === "triangle" ? <TriangleVisual visual={visual} /> : null}
    </div>
  );
}

function VoterChip(props: { voter: DailyQuestionVoter }): JSX.Element {
  const { voter } = props;
  return (
    <span className="question-voter" title={voter.nickname}>
      <UserAvatar user={voter} className="" fallbackClassName="question-voter-fallback" />
      <span>{voter.nickname}</span>
    </span>
  );
}

function ResultSummary(props: { result: DailyQuestionResult; options: string[] }): JSX.Element {
  const correctOption = props.options[props.result.correctAnswerIndex] ?? "";
  return (
    <div className={`question-result ${props.result.isCorrect ? "correct" : "wrong"}`}>
      <strong>{props.result.isCorrect ? "答对了" : "答错了"}</strong>
      <span>
        正确答案：{getChoiceLabel(props.result.correctAnswerIndex)}. {correctOption}
      </span>
      <p>{props.result.explanation}</p>
    </div>
  );
}

function renderStats(
  stats: DailyQuestionStats,
  options: string[],
  answeredIndex: number | null,
  correctAnswerIndex: number | null
): JSX.Element {
  return (
    <div className="question-stats">
      {options.map((option, index) => {
        const count = stats.counts[index] ?? 0;
        const percent = getPercent(count, stats.totalAnswers);
        const voters = stats.voters[index] ?? [];
        const isMine = answeredIndex === index;
        const isCorrect = correctAnswerIndex === index;
        return (
          <div
            key={index}
            className={`question-stat-item ${isMine ? "mine" : ""} ${isCorrect ? "correct" : ""}`}
          >
            <div className="question-stat-top">
              <div>
                <span className="question-choice-index">{getChoiceLabel(index)}</span>
                <span>{option}</span>
              </div>
              <strong>
                {count} 票 · {percent}%
              </strong>
            </div>
            <div className="question-stat-bar" aria-hidden="true">
              <div style={{ width: `${percent}%` }} />
            </div>
            <div className="question-voters">
              {voters.length > 0 ? voters.map((voter) => <VoterChip key={voter.id} voter={voter} />) : <span>还没有人选择</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const DailyQuestionPanel = memo(function DailyQuestionPanel(props: DailyQuestionPanelProps): JSX.Element {
  if (props.loading) {
    return (
      <section className="module-card daily-card">
        <h2>每日一题</h2>
        <p className="muted-text">正在加载题目...</p>
      </section>
    );
  }

  if (!props.data) {
    return (
      <section className="module-card daily-card">
        <h2>每日一题</h2>
        <p className="muted-text">{props.error || "暂时没有可用题目。"}</p>
        <button type="button" className="ghost-button" onClick={() => void props.onRefresh()}>
          重试
        </button>
      </section>
    );
  }

  const { question, stats, answeredIndex, result } = props.data;
  const answered = answeredIndex !== null;

  return (
    <section className="module-card daily-card">
      <div className="module-head daily-head">
        <div className="daily-title-row">
          <h2>每日一题</h2>
          <span className="question-category">{question.category}</span>
          <span className="question-date">{question.date}</span>
        </div>
        <button type="button" className="ghost-button" onClick={() => void props.onRefresh()}>
          刷新
        </button>
      </div>

      <div className="daily-content">
        <h3 className="question-title">{question.question}</h3>
        <QuestionVisual visual={question.visual} />

        {!answered ? (
          <div className="question-options">
            {question.options.map((option, index) => (
              <button key={index} type="button" onClick={() => void props.onAnswer(index)}>
                <span>{getChoiceLabel(index)}</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <>
            {result ? <ResultSummary result={result} options={question.options} /> : null}
            <p className="question-note">下面是大家的实时选择。</p>
            {renderStats(stats, question.options, answeredIndex, result?.correctAnswerIndex ?? null)}
          </>
        )}

        {props.error ? <p className="error-text">{props.error}</p> : null}
      </div>
    </section>
  );
});
