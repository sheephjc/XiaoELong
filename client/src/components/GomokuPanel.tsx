import {
  memo,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import type { GomokuGame, PresenceUser, UserProfile } from "@xiaoelong/shared";
import { UserAvatar } from "./UserAvatar";

interface GomokuPanelProps {
  currentUser: UserProfile;
  users: PresenceUser[];
  games: GomokuGame[];
  selectedGameId: number | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSelectGame: (gameId: number) => void;
  onInvite: (targetUserId: string) => Promise<void>;
  onAccept: (gameId: number) => Promise<void>;
  onReject: (gameId: number) => Promise<void>;
  onMove: (gameId: number, row: number, col: number) => Promise<boolean>;
}

function getOpponent(game: GomokuGame, userId: string): UserProfile {
  return game.playerBlack.id === userId ? game.playerWhite : game.playerBlack;
}

function formatStatus(game: GomokuGame, currentUserId: string): string {
  if (game.status === "invited") {
    return game.playerWhite.id === currentUserId ? "待你接受" : "等待对方接受";
  }
  if (game.status === "playing") {
    const currentPlayer = game.currentTurn === game.playerBlack.id
      ? game.playerBlack
      : game.currentTurn === game.playerWhite.id
        ? game.playerWhite
        : null;
    return currentPlayer ? `轮到${currentPlayer.nickname}行棋` : "等待行棋";
  }
  if (game.status === "finished") {
    const winner = game.winner === game.playerBlack.id
      ? game.playerBlack
      : game.winner === game.playerWhite.id
        ? game.playerWhite
        : null;
    return winner ? `${winner.nickname}胜！` : "和棋";
  }
  return "已拒绝";
}

function getPlayerColor(game: GomokuGame, currentUserId: string): "黑" | "白" {
  return game.playerBlack.id === currentUserId ? "黑" : "白";
}

function getBlockingInviteLabel(game: GomokuGame | undefined): string | null {
  if (game?.status === "invited") {
    return "有未接受对局";
  }
  if (game?.status === "playing") {
    return "对局进行中";
  }
  return null;
}

function MiniAvatar(props: { user: UserProfile; dim?: boolean }): JSX.Element {
  return <UserAvatar user={props.user} dim={props.dim} />;
}

interface PendingMove {
  gameId: number;
  row: number;
  col: number;
  stone: 1 | 2;
}

interface RenderedStone {
  row: number;
  col: number;
  stone: 1 | 2;
}

type GomokuResultKind = "victory" | "defeat";

function GomokuResultEffect(props: { kind: GomokuResultKind; gameId: number }): JSX.Element {
  return (
    <div
      key={`${props.gameId}-${props.kind}`}
      className={`gomoku-result-effect ${props.kind}`}
      aria-hidden="true"
    >
      {props.kind === "victory" ? (
        <>
          {Array.from({ length: 6 }, (_, fireworkIndex) => (
            <span
              key={fireworkIndex}
              className={`gomoku-firework gomoku-firework-${fireworkIndex + 1}`}
            >
              {Array.from({ length: 10 }, (_, particleIndex) => (
                <span key={particleIndex} className="gomoku-firework-particle" />
              ))}
            </span>
          ))}
          <span className="gomoku-victory-glint">★</span>
        </>
      ) : (
        <>
          <span className="gomoku-defeat-sigh" />
          {Array.from({ length: 7 }, (_, dropIndex) => (
            <span key={dropIndex} className={`gomoku-defeat-drop gomoku-defeat-drop-${dropIndex + 1}`} />
          ))}
        </>
      )}
    </div>
  );
}

const Board = memo(function Board(props: {
  game: GomokuGame;
  currentUserId: string;
  onMove: (gameId: number, row: number, col: number) => Promise<boolean>;
}): JSX.Element {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [keyboardCell, setKeyboardCell] = useState({ row: 7, col: 7 });
  const canMove = props.game.status === "playing" && props.game.currentTurn === props.currentUserId;
  const activePendingMove = pendingMove?.gameId === props.game.id ? pendingMove : null;
  const rowCount = props.game.boardState.length || 15;
  const columnCount = props.game.boardState[0]?.length || 15;
  const renderedStones = useMemo(() => {
    const stones: RenderedStone[] = [];
    props.game.boardState.forEach((rowCells, row) => {
      rowCells.forEach((cell, col) => {
        const renderedCell =
          activePendingMove?.row === row && activePendingMove.col === col ? activePendingMove.stone : cell;
        if (renderedCell === 1 || renderedCell === 2) {
          stones.push({ row, col, stone: renderedCell });
        }
      });
    });
    return stones;
  }, [props.game.boardState, activePendingMove]);

  useEffect(() => {
    setPendingMove((current) => {
      if (!current) {
        return current;
      }
      if (current.gameId !== props.game.id) {
        return null;
      }

      const moveWasCommitted = props.game.boardState[current.row]?.[current.col] !== 0;
      const turnWasAdvanced = props.game.status !== "playing" || props.game.currentTurn !== props.currentUserId;
      return moveWasCommitted || turnWasAdvanced ? null : current;
    });
  }, [props.game, props.currentUserId]);

  function clearPendingMove(move: PendingMove): void {
    setPendingMove((current) =>
      current?.gameId === move.gameId && current.row === move.row && current.col === move.col ? null : current
    );
  }

  function tryMove(row: number, col: number): void {
    if (!canMove || activePendingMove) {
      return;
    }
    if (!Number.isInteger(row) || !Number.isInteger(col) || props.game.boardState[row]?.[col] !== 0) {
      return;
    }

    setKeyboardCell((current) => (current.row === row && current.col === col ? current : { row, col }));
    const move: PendingMove = {
      gameId: props.game.id,
      row,
      col,
      stone: props.game.playerBlack.id === props.currentUserId ? 1 : 2
    };
    setPendingMove(move);
    void props.onMove(move.gameId, move.row, move.col).then((accepted) => {
      if (!accepted) {
        clearPendingMove(move);
      }
    }, () => clearPendingMove(move));
  }

  function handleBoardClick(event: ReactMouseEvent<HTMLDivElement>): void {
    const board = event.currentTarget;
    const bounds = board.getBoundingClientRect();
    const width = board.clientWidth;
    const height = board.clientHeight;
    const x = event.clientX - bounds.left - board.clientLeft;
    const y = event.clientY - bounds.top - board.clientTop;
    if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const row = Math.floor((y / height) * rowCount);
    const col = Math.floor((x / width) * columnCount);
    tryMove(row, col);
  }

  function handleBoardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (!canMove || activePendingMove) {
      return;
    }

    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      setKeyboardCell((current) => {
        const row = Math.max(0, Math.min(rowCount - 1, current.row + direction[0]));
        const columnsInRow = props.game.boardState[row]?.length || columnCount;
        const col = Math.max(0, Math.min(columnsInRow - 1, current.col + direction[1]));
        return row === current.row && col === current.col ? current : { row, col };
      });
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      tryMove(keyboardCell.row, keyboardCell.col);
    }
  }

  const activeCellId = `gomoku-cell-${props.game.id}-${keyboardCell.row}-${keyboardCell.col}`;
  const activeCellValue =
    activePendingMove?.row === keyboardCell.row && activePendingMove.col === keyboardCell.col
      ? activePendingMove.stone
      : (props.game.boardState[keyboardCell.row]?.[keyboardCell.col] ?? 0);
  const activeCellState = activeCellValue === 1 ? "黑子" : activeCellValue === 2 ? "白子" : "空位";
  const resultKind: GomokuResultKind | null =
    props.game.status === "finished" && props.game.winner
      ? props.game.winner === props.currentUserId
        ? "victory"
        : "defeat"
      : null;

  return (
    <div className={`gomoku-board-wrap ${resultKind ?? ""}`}>
      <div
        className={`gomoku-board ${canMove && !activePendingMove ? "playable" : ""}`}
        role="grid"
        aria-label="五子棋棋盘"
        aria-disabled={!canMove || Boolean(activePendingMove)}
        aria-activedescendant={activeCellId}
        tabIndex={canMove && !activePendingMove ? 0 : -1}
        onClick={handleBoardClick}
        onKeyDown={handleBoardKeyDown}
        style={{
          backgroundSize: `${100 / columnCount}% 100%, 100% ${100 / rowCount}%`
        }}
      >
        {renderedStones.map((stone) => (
          <span
            key={`${stone.row}-${stone.col}`}
            className={`gomoku-stone ${stone.stone === 1 ? "black" : "white"}`}
            aria-hidden="true"
            style={{
              left: `${((stone.col + 0.5) / columnCount) * 100}%`,
              top: `${((stone.row + 0.5) / rowCount) * 100}%`,
              width: `${(0.68 / columnCount) * 100}%`,
              height: `${(0.68 / rowCount) * 100}%`
            }}
          />
        ))}
        <span
          id={activeCellId}
          role="gridcell"
          className="gomoku-keyboard-target"
          aria-rowindex={keyboardCell.row + 1}
          aria-colindex={keyboardCell.col + 1}
          aria-disabled={activeCellValue !== 0}
          aria-label={`第 ${keyboardCell.row + 1} 行第 ${keyboardCell.col + 1} 列，${activeCellState}`}
          style={{
            left: `${(keyboardCell.col / columnCount) * 100}%`,
            top: `${(keyboardCell.row / rowCount) * 100}%`,
            width: `${100 / columnCount}%`,
            height: `${100 / rowCount}%`
          }}
        />
      </div>
      {resultKind ? <GomokuResultEffect kind={resultKind} gameId={props.game.id} /> : null}
    </div>
  );
});

export const GomokuPanel = memo(function GomokuPanel(props: GomokuPanelProps): JSX.Element {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const selectedGame = useMemo(
    () => props.games.find((game) => game.id === props.selectedGameId) ?? props.games[0] ?? null,
    [props.games, props.selectedGameId]
  );

  const inviteCandidates = useMemo(() => {
    return props.users
      .filter((user) => user.id !== props.currentUser.id)
      .map((user) => ({
        user,
        blockingGame: props.games.find((game) =>
          (game.status === "invited" || game.status === "playing")
          && getOpponent(game, props.currentUser.id).id === user.id
        )
      }))
      .sort((left, right) =>
        Number(right.user.isOnline) - Number(left.user.isOnline)
        || left.user.nickname.localeCompare(right.user.nickname, "zh-CN")
      );
  }, [props.users, props.games, props.currentUser.id]);

  async function handleInvite(userId: string): Promise<void> {
    setInvitingUserId(userId);
    try {
      await props.onInvite(userId);
      setInviteOpen(false);
    } finally {
      setInvitingUserId(null);
    }
  }

  return (
    <section className="module-card gomoku-card">
      <div className="module-head">
        <h2>五子棋</h2>
        <div className="gomoku-actions">
          <div className="invite-popover-wrap">
            <button type="button" className="primary-soft-button" onClick={() => setInviteOpen((open) => !open)}>
              邀请
            </button>
            {inviteOpen ? (
              <div className="invite-popover" role="dialog" aria-label="选择邀请成员">
                <div className="invite-popover-head">
                  <strong>选择成员</strong>
                  <button type="button" className="icon-text-button" onClick={() => setInviteOpen(false)}>
                    关闭
                  </button>
                </div>
                <div className="invite-candidate-list">
                  {inviteCandidates.length === 0 ? <p className="muted-text">还没有可邀请的成员。</p> : null}
                  {inviteCandidates.map(({ user: candidate, blockingGame }) => {
                    const blockingLabel = getBlockingInviteLabel(blockingGame);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`invite-candidate ${candidate.isOnline ? "online" : "offline"}`}
                        disabled={invitingUserId !== null || Boolean(blockingLabel)}
                        onClick={() => void handleInvite(candidate.id)}
                      >
                        <MiniAvatar user={candidate} dim={!candidate.isOnline} />
                        <span>{candidate.nickname}</span>
                        <small>{blockingLabel ?? (candidate.isOnline ? "在线" : "离线")}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <button type="button" className="ghost-button" onClick={() => void props.onRefresh()}>
            刷新
          </button>
        </div>
      </div>

      <div className="gomoku-layout">
        <aside className="gomoku-left">
          <h3>我的对局</h3>
          <div className="gomoku-game-list">
            {props.loading ? <p className="muted-text">加载中...</p> : null}
            {!props.loading && props.games.length === 0 ? <p className="muted-text">还没有对局。</p> : null}
            {props.games.map((game) => {
              const opponent = getOpponent(game, props.currentUser.id);
              const selected = selectedGame?.id === game.id;
              return (
                <button
                  key={game.id}
                  type="button"
                  className={`gomoku-game-item ${selected ? "selected" : ""}`}
                  onClick={() => props.onSelectGame(game.id)}
                >
                  <strong>{opponent.nickname}</strong>
                  <em>{formatStatus(game, props.currentUser.id)}</em>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="gomoku-right">
          {!selectedGame ? <p className="muted-text">先邀请一位成员开始对局。</p> : null}
          {selectedGame ? (
            <>
              <div className="gomoku-game-head">
                <strong>{`对手：${getOpponent(selectedGame, props.currentUser.id).nickname}，你执${getPlayerColor(selectedGame, props.currentUser.id)}`}</strong>
                <em>{formatStatus(selectedGame, props.currentUser.id)}</em>
              </div>

              {selectedGame.status === "invited" && selectedGame.playerWhite.id === props.currentUser.id ? (
                <div className="gomoku-invite-response-actions">
                  <button type="button" className="primary-soft-button" onClick={() => void props.onAccept(selectedGame.id)}>
                    接受邀请
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void props.onReject(selectedGame.id)}>
                    拒绝
                  </button>
                </div>
              ) : null}

              <Board
                game={selectedGame}
                currentUserId={props.currentUser.id}
                onMove={props.onMove}
              />
            </>
          ) : null}
        </div>
      </div>

      {props.error ? <p className="error-text">{props.error}</p> : null}
    </section>
  );
});
