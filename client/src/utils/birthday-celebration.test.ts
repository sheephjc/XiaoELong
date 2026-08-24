import { describe, expect, it, vi } from "vitest";
import {
  BIRTHDAYS,
  getBirthdayCelebration,
  getBirthdaySeenStorageKey,
  rememberBirthdayDialog,
  shouldShowBirthdayDialog
} from "./birthday-celebration";

describe("birthday celebration", () => {
  it("包含全部成员的生日配置", () => {
    expect(BIRTHDAYS).toEqual([
      { name: "HJC", month: 12, day: 10 },
      { name: "HSX", month: 1, day: 10 },
      { name: "mx", month: 4, day: 18 },
      { name: "chui", month: 6, day: 9 },
      { name: "郭", month: 8, day: 24 },
      { name: "HF", month: 2, day: 18 },
      { name: "A神", month: 6, day: 21 }
    ]);
  });

  it.each(BIRTHDAYS)("在 $name 的生日当天返回祝福", ({ name, month, day }) => {
    const celebration = getBirthdayCelebration(new Date(2026, month - 1, day, 12));

    expect(celebration?.celebrants.map((celebrant) => celebrant.name)).toContain(name);
    expect(celebration?.greeting).toContain(`祝${name}`);
  });

  it("普通日期不展示生日特效", () => {
    expect(getBirthdayCelebration(new Date(2026, 8, 1, 12))).toBeNull();
  });

  it("关闭后记录当年日期，明年仍会再次展示", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value))
    };
    const thisYear = getBirthdayCelebration(new Date(2026, 7, 24, 12));
    const nextYear = getBirthdayCelebration(new Date(2027, 7, 24, 12));

    expect(thisYear).not.toBeNull();
    expect(nextYear).not.toBeNull();
    if (!thisYear || !nextYear) {
      return;
    }

    expect(shouldShowBirthdayDialog(thisYear, storage)).toBe(true);
    rememberBirthdayDialog(thisYear, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      getBirthdaySeenStorageKey("2026-08-24"),
      "seen"
    );
    expect(shouldShowBirthdayDialog(thisYear, storage)).toBe(false);
    expect(shouldShowBirthdayDialog(nextYear, storage)).toBe(true);
  });
});
