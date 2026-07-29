import { describe, expect, it } from "vitest";
import renderSessionModule from "./render-session.js";

const { createRenderSession } = renderSessionModule;

describe("render session", () => {
  it("only accepts the latest positive request once", () => {
    const session = createRenderSession();
    const firstHome = session.begin();
    const settings = session.begin();
    const latestHome = session.begin();

    expect(firstHome).toBeLessThan(settings);
    expect(settings).toBeLessThan(latestHome);
    expect(session.accept(firstHome)).toBe(false);
    expect(session.accept(settings)).toBe(false);
    expect(session.accept(0)).toBe(false);
    expect(session.accept(Number.NaN)).toBe(false);
    expect(session.accept(latestHome)).toBe(true);
    expect(session.accept(latestHome)).toBe(false);
    expect(session.current()).toBe(0);
  });

  it("creates a recovery request and invalidates it when canceled", () => {
    const session = createRenderSession();
    const initialRequest = session.begin();

    expect(session.accept(initialRequest)).toBe(true);
    const recoveryRequest = session.ensurePending();
    expect(recoveryRequest).toBeGreaterThan(initialRequest);
    expect(session.ensurePending()).toBe(recoveryRequest);

    session.cancel();
    expect(session.current()).toBe(0);
    expect(session.accept(recoveryRequest)).toBe(false);
  });
});
