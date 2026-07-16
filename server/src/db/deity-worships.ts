import {
  DEITY_CATALOG,
  getDeityRank,
  getNextDeityThreshold,
  type DeityId,
  type DeityStatus,
  type DeityWorshipRecord
} from "@xiaoelong/shared";
import type { RowDataPacket } from "mysql2";
import { pool } from "./pool.js";
import { getResetDayInTimezone, toIsoString } from "../utils/time.js";

const DEITY_TIMEZONE = "Asia/Shanghai";
const DEITY_RESET_HOUR = 8;
const DEITY_WORSHIP_LOCK = "xiaoelong:deity-worship";

interface DeityWorshipRow extends RowDataPacket {
  deity_id: DeityId;
  worship_day: string;
  worshipped_at: Date | string;
}

interface DeityCountRow extends RowDataPacket {
  deity_id: DeityId;
  total_worships: number | string;
}

interface DeityTotalRow extends RowDataPacket {
  total_worships: number | string;
}

interface NamedLockRow extends RowDataPacket {
  acquired: number | string | null;
}

export interface CreatedDeityWorship {
  worship: DeityWorshipRecord;
  previousTotal: number;
}

export function getCurrentDeityWorshipDay(now = new Date()): string {
  return getResetDayInTimezone(now, DEITY_TIMEZONE, DEITY_RESET_HOUR);
}

export function isDeityId(value: unknown): value is DeityId {
  return typeof value === "string" && DEITY_CATALOG.some((deity) => deity.id === value);
}

export function isDuplicateDeityWorshipError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

function mapWorshipRow(row: DeityWorshipRow): DeityWorshipRecord {
  return {
    deityId: row.deity_id,
    worshipDay: String(row.worship_day).slice(0, 10),
    worshippedAt: toIsoString(row.worshipped_at)
  };
}

function createStatus(deityId: DeityId, totalWorships: number): DeityStatus {
  const rank = getDeityRank(totalWorships);
  return {
    deityId,
    totalWorships,
    rank,
    nextThreshold: getNextDeityThreshold(rank)
  };
}

export async function getDeityWorshipForUser(
  userId: string,
  worshipDay = getCurrentDeityWorshipDay()
): Promise<DeityWorshipRecord | null> {
  const [rows] = await pool.query<DeityWorshipRow[]>(
    `SELECT deity_id, worship_day, worshipped_at
     FROM deity_worships
     WHERE user_id = ? AND worship_day = ?
     LIMIT 1`,
    [userId, worshipDay]
  );

  return rows.length > 0 ? mapWorshipRow(rows[0]) : null;
}

export async function listDeityStatuses(): Promise<DeityStatus[]> {
  const [rows] = await pool.query<DeityCountRow[]>(
    `SELECT deity_id, COUNT(*) AS total_worships
     FROM deity_worships
     GROUP BY deity_id`
  );
  const counts = new Map<DeityId, number>(
    rows.filter((row) => isDeityId(row.deity_id)).map((row) => [row.deity_id, Number(row.total_worships)])
  );

  return DEITY_CATALOG.map((deity) => createStatus(deity.id, counts.get(deity.id) ?? 0));
}

export async function createDeityWorship(
  userId: string,
  deityId: DeityId,
  worshipDay = getCurrentDeityWorshipDay()
): Promise<CreatedDeityWorship> {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<NamedLockRow[]>(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [DEITY_WORSHIP_LOCK]
    );
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) {
      throw new Error("Deity worship is busy. Please retry.");
    }

    await connection.beginTransaction();

    // All worship submissions briefly share a database-level lock. This makes
    // cross-deity requests for the same daily slot deterministic and also gives
    // promotion thresholds an exact pre-insert count without storing a counter.
    const [countRows] = await connection.query<DeityTotalRow[]>(
      `SELECT COUNT(*) AS total_worships
       FROM deity_worships
       WHERE deity_id = ?`,
      [deityId]
    );
    const previousTotal = Number(countRows[0]?.total_worships ?? 0);

    await connection.execute(
      `INSERT INTO deity_worships (user_id, deity_id, worship_day)
       VALUES (?, ?, ?)`,
      [userId, deityId, worshipDay]
    );

    const [rows] = await connection.query<DeityWorshipRow[]>(
      `SELECT deity_id, worship_day, worshipped_at
       FROM deity_worships
       WHERE user_id = ? AND worship_day = ?
       LIMIT 1`,
      [userId, worshipDay]
    );
    if (rows.length === 0) {
      throw new Error("Deity worship insert could not be read back.");
    }

    await connection.commit();
    return {
      worship: mapWorshipRow(rows[0]),
      previousTotal
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (lockAcquired) {
      await connection.query("SELECT RELEASE_LOCK(?)", [DEITY_WORSHIP_LOCK]).catch(() => undefined);
    }
    connection.release();
  }
}
