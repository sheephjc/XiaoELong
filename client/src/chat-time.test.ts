import { describe, expect, it } from "vitest";
import { formatChatTimestamp } from "./chat-time";

describe("formatChatTimestamp", () => {
  it("shows only the time for a message from today in Asia/Shanghai", () => {
    expect(
      formatChatTimestamp(
        "2026-07-29T16:30:00.000Z",
        new Date("2026-07-30T15:00:00.000Z")
      )
    ).toBe("00:30");
  });

  it("adds the full date for a message from an earlier day", () => {
    expect(
      formatChatTimestamp(
        "2026-07-29T15:59:00.000Z",
        new Date("2026-07-30T00:00:00.000Z")
      )
    ).toBe("2026-07-29 23:59");
  });

  it("uses the full date across year boundaries", () => {
    expect(
      formatChatTimestamp(
        "2025-12-31T15:59:00.000Z",
        new Date("2025-12-31T16:01:00.000Z")
      )
    ).toBe("2025-12-31 23:59");
  });

  it("returns a placeholder for invalid timestamps", () => {
    expect(formatChatTimestamp("not-a-date")).toBe("--:--");
  });
});
