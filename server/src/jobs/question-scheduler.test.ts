// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import cron from "node-cron";
import type { DailyQuestionService } from "../services/daily-question-service.js";

vi.mock("../config/env.js", () => ({
  env: { QUESTION_CRON: "0 8 * * *", QUESTION_TIMEZONE: "Asia/Shanghai" }
}));

import { startQuestionScheduler } from "./question-scheduler.js";

afterEach(async () => {
  for (const task of cron.getTasks().values()) await task.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("daily question scheduler with node-cron v4", () => {
  it("runs at 08:00 Shanghai time without running immediately on startup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T23:59:59.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    const ensureTodayQuestion = vi.fn().mockResolvedValue({
      date: "2026-09-14", sourceType: "question_bank"
    });
    startQuestionScheduler({ ensureTodayQuestion } as unknown as DailyQuestionService);
    expect(ensureTodayQuestion).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(ensureTodayQuestion).toHaveBeenCalledTimes(1);
  });

  it("continues scheduling after a database failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T23:59:59.000Z"));
    const error = new Error("database temporarily unavailable");
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const ensureTodayQuestion = vi.fn().mockRejectedValueOnce(error)
      .mockResolvedValue({ date: "2026-09-15", sourceType: "question_bank" });
    startQuestionScheduler({ ensureTodayQuestion } as unknown as DailyQuestionService);
    await vi.advanceTimersByTimeAsync(1100);
    expect(logError).toHaveBeenCalledWith("[DailyQuestion] Scheduled question selection failed:", error);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(ensureTodayQuestion).toHaveBeenCalledTimes(2);
  });
});
