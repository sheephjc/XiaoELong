import type { GomokuGame, UserProfile } from "@xiaoelong/shared";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { toIsoString } from "../utils/time.js";

const BOARD_SIZE = 15;

interface GomokuGameRow extends RowDataPacket {
  id: number;
  status: "invited" | "playing" | "finished" | "declined";
  invited_by: string;
  player_black: string;
  player_white: string;
  current_turn: string | null;
  winner: string | null;
  board_state: string | number[][];
  created_at: Date | string;
  updated_at: Date | string;
  black_nickname: string;
  black_avatar_url: string | null;
  black_created_at: Date | string;
  white_nickname: string;
  white_avatar_url: string | null;
  white_created_at: Date | string;
}

export class GomokuValidationError extends Error {}

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
}

function parseBoardState(raw: string | number[][]): number[][] {
  if (Array.isArray(raw)) {
    return raw;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return createEmptyBoard();
    }
    return parsed as number[][];
  } catch {
    return createEmptyBoard();
  }
}

function isBoardCoordinateValid(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function countInDirection(board: number[][], row: number, col: number, stone: number, dr: number, dc: number): number {
  let total = 0;
  let r = row + dr;
  let c = col + dc;
  while (isBoardCoordinateValid(r, c) && board[r][c] === stone) {
    total += 1;
    r += dr;
    c += dc;
  }
  return total;
}

function hasWin(board: number[][], row: number, col: number, stone: number): boolean {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dr, dc] of directions) {
    const count = 1 + countInDirection(board, row, col, stone, dr, dc) + countInDirection(board, row, col, stone, -dr, -dc);
    if (count >= 5) {
      return true;
    }
  }
  return false;
}

function mapUserProfile(input: {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: Date | string;
}): UserProfile {
  return {
    id: input.id,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
    createdAt: toIsoString(input.createdAt)
  };
}

function mapGameRow(row: GomokuGameRow): GomokuGame {
  return {
    id: row.id,
    status: row.status,
    invitedBy: row.invited_by,
    currentTurn: row.current_turn,
    winner: row.winner,
    boardState: parseBoardState(row.board_state),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    playerBlack: mapUserProfile({
      id: row.player_black,
      nickname: row.black_nickname,
      avatarUrl: row.black_avatar_url,
      createdAt: row.black_created_at
    }),
    playerWhite: mapUserProfile({
      id: row.player_white,
      nickname: row.white_nickname,
      avatarUrl: row.white_avatar_url,
      createdAt: row.white_created_at
    })
  };
}

const GAME_SELECT_SQL = `
  SELECT
    g.id,
    g.status,
    g.invited_by,
    g.player_black,
    g.player_white,
    g.current_turn,
    g.winner,
    g.board_state,
    g.created_at,
    g.updated_at,
    ub.nickname AS black_nickname,
    ub.avatar_url AS black_avatar_url,
    ub.created_at AS black_created_at,
    uw.nickname AS white_nickname,
    uw.avatar_url AS white_avatar_url,
    uw.created_at AS white_created_at
  FROM gomoku_games g
  INNER JOIN users ub ON ub.id = g.player_black
  INNER JOIN users uw ON uw.id = g.player_white
`;

async function loadGameById(gameId: number, connection?: PoolConnection): Promise<GomokuGame | null> {
  const executor = connection ?? pool;
  const [rows] = await executor.query<GomokuGameRow[]>(
    `${GAME_SELECT_SQL} WHERE g.id = ? LIMIT 1`,
    [gameId]
  );

  if (rows.length === 0) {
    return null;
  }
  return mapGameRow(rows[0]);
}

export class GomokuService {
  async listGamesForUser(userId: string): Promise<GomokuGame[]> {
    const [rows] = await pool.query<GomokuGameRow[]>(
      `${GAME_SELECT_SQL}
       WHERE g.player_black = ? OR g.player_white = ?
       ORDER BY g.updated_at DESC, g.id DESC`,
      [userId, userId]
    );

    return rows.map(mapGameRow);
  }

  async listActiveGameIdsForUser(userId: string): Promise<number[]> {
    const [rows] = await pool.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id
       FROM gomoku_games
       WHERE (player_black = ? OR player_white = ?)
         AND status IN ('invited', 'playing')`,
      [userId, userId]
    );
    return rows.map((row) => row.id);
  }

  async getGameById(gameId: number): Promise<GomokuGame | null> {
    return loadGameById(gameId);
  }

  async createInvite(initiatorUserId: string, targetUserId: string): Promise<GomokuGame> {
    if (initiatorUserId === targetUserId) {
      throw new GomokuValidationError("Cannot invite yourself.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [users] = await connection.query<Array<RowDataPacket & { id: string }>>(
        `SELECT id
         FROM users
         WHERE id IN (?, ?)
         ORDER BY id
         FOR UPDATE`,
        [initiatorUserId, targetUserId]
      );
      if (users.length !== 2) {
        throw new GomokuValidationError("玩家不存在。");
      }

      const [activeGames] = await connection.query<Array<RowDataPacket & {
        id: number;
        status: "invited" | "playing";
      }>>(
        `SELECT id, status
         FROM gomoku_games
         WHERE status IN ('invited', 'playing')
           AND ((player_black = ? AND player_white = ?)
             OR (player_black = ? AND player_white = ?))
         LIMIT 1
         FOR UPDATE`,
        [initiatorUserId, targetUserId, targetUserId, initiatorUserId]
      );
      if (activeGames.length > 0) {
        throw new GomokuValidationError(
          activeGames[0].status === "invited" ? "有未接受对局。" : "对局仍在进行中。"
        );
      }

      const boardState = JSON.stringify(createEmptyBoard());
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO gomoku_games
         (status, invited_by, player_black, player_white, current_turn, winner, board_state)
         VALUES ('invited', ?, ?, ?, NULL, NULL, ?)`,
        [initiatorUserId, initiatorUserId, targetUserId, boardState]
      );

      const game = await loadGameById(result.insertId, connection);
      if (!game) {
        throw new Error("Failed to create gomoku game.");
      }

      await connection.commit();
      return game;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async acceptInvite(gameId: number, userId: string): Promise<GomokuGame> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE gomoku_games
       SET status = 'playing',
           current_turn = player_black,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status = 'invited'
         AND player_white = ?`,
      [gameId, userId]
    );

    if (result.affectedRows === 0) {
      throw new GomokuValidationError("Invite cannot be accepted.");
    }

    const game = await loadGameById(gameId);
    if (!game) {
      throw new Error("Game not found after accept.");
    }
    return game;
  }

  async rejectInvite(gameId: number, userId: string): Promise<GomokuGame> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE gomoku_games
       SET status = 'declined',
           current_turn = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status = 'invited'
         AND player_white = ?`,
      [gameId, userId]
    );

    if (result.affectedRows === 0) {
      throw new GomokuValidationError("Invite cannot be rejected.");
    }

    const game = await loadGameById(gameId);
    if (!game) {
      throw new Error("Game not found after reject.");
    }
    return game;
  }

  async makeMove(gameId: number, userId: string, row: number, col: number): Promise<GomokuGame> {
    if (!isBoardCoordinateValid(row, col)) {
      throw new GomokuValidationError("Move is out of board.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<GomokuGameRow[]>(
        `${GAME_SELECT_SQL}
         WHERE g.id = ?
         FOR UPDATE`,
        [gameId]
      );

      if (rows.length === 0) {
        throw new GomokuValidationError("Game not found.");
      }

      const rowData = rows[0];
      if (rowData.status !== "playing") {
        throw new GomokuValidationError("Game is not in playing state.");
      }
      if (rowData.current_turn !== userId) {
        throw new GomokuValidationError("It is not your turn.");
      }
      if (userId !== rowData.player_black && userId !== rowData.player_white) {
        throw new GomokuValidationError("You are not part of this game.");
      }

      const board = parseBoardState(rowData.board_state);
      if (board[row][col] !== 0) {
        throw new GomokuValidationError("This position is already occupied.");
      }

      const stone = userId === rowData.player_black ? 1 : 2;
      board[row][col] = stone;

      const [moveCountRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
        "SELECT COUNT(*) AS count FROM gomoku_moves WHERE game_id = ?",
        [gameId]
      );
      const nextMoveNo = Number(moveCountRows[0]?.count ?? 0) + 1;

      await connection.execute(
        `INSERT INTO gomoku_moves (game_id, move_no, player_id, row_idx, col_idx)
         VALUES (?, ?, ?, ?, ?)`,
        [gameId, nextMoveNo, userId, row, col]
      );

      const win = hasWin(board, row, col, stone);
      const nextTurn = userId === rowData.player_black ? rowData.player_white : rowData.player_black;
      await connection.execute(
        `UPDATE gomoku_games
         SET board_state = ?,
             current_turn = ?,
             winner = ?,
             status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          JSON.stringify(board),
          win ? null : nextTurn,
          win ? userId : null,
          win ? "finished" : "playing",
          gameId
        ]
      );

      await connection.commit();

      const updated = await loadGameById(gameId);
      if (!updated) {
        throw new Error("Game not found after move.");
      }
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
