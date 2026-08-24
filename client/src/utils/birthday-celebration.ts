export interface BirthdayEntry {
  name: string;
  month: number;
  day: number;
}

export interface BirthdayCelebration {
  celebrants: readonly BirthdayEntry[];
  dateKey: string;
  month: number;
  day: number;
  greeting: string;
}

interface BirthdayStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const BIRTHDAYS: readonly BirthdayEntry[] = [
  { name: "HJC", month: 12, day: 10 },
  { name: "HSX", month: 1, day: 10 },
  { name: "mx", month: 4, day: 18 },
  { name: "chui", month: 6, day: 9 },
  { name: "郭", month: 8, day: 24 },
  { name: "HF", month: 2, day: 18 },
  { name: "A神", month: 6, day: 21 }
];

export const BIRTHDAY_SEEN_STORAGE_KEY_PREFIX = "xiaoelong_birthday_celebration_seen";

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function getBirthdayCelebration(date = new Date()): BirthdayCelebration | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const celebrants = BIRTHDAYS.filter((birthday) => birthday.month === month && birthday.day === day);

  if (celebrants.length === 0) {
    return null;
  }

  const names = celebrants.map((birthday) => birthday.name).join("、");
  return {
    celebrants,
    dateKey: `${date.getFullYear()}-${padDatePart(month)}-${padDatePart(day)}`,
    month,
    day,
    greeting: `祝${names}生日快乐！🥳🥳🥳`
  };
}

export function getBirthdaySeenStorageKey(dateKey: string): string {
  return `${BIRTHDAY_SEEN_STORAGE_KEY_PREFIX}:${dateKey}`;
}

export function shouldShowBirthdayDialog(
  celebration: BirthdayCelebration,
  storage?: BirthdayStorage
): boolean {
  try {
    const targetStorage = storage ?? globalThis.localStorage;
    return targetStorage.getItem(getBirthdaySeenStorageKey(celebration.dateKey)) !== "seen";
  } catch {
    return true;
  }
}

export function rememberBirthdayDialog(
  celebration: BirthdayCelebration,
  storage?: BirthdayStorage
): void {
  try {
    const targetStorage = storage ?? globalThis.localStorage;
    targetStorage.setItem(getBirthdaySeenStorageKey(celebration.dateKey), "seen");
  } catch {
    // 存储不可用时只影响当天不再展示，不阻止关闭祝福。
  }
}
