// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../test-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MoodEmoji, PresenceUser, UserProfile } from "@xiaoelong/shared";
import { useAuth, type AuthContextValue } from "../../contexts/AuthContext";
import { useChat, type ChatContextValue } from "../../contexts/ChatContext";
import { useDaily, type DailyContextValue } from "../../contexts/DailyContext";
import { useDesktop, type DesktopContextValue } from "../../contexts/DesktopContext";
import { StatusBar } from "./StatusBar";

// ============================================================
// Mock 依赖：AuthContext / ChatContext / DailyContext / DesktopContext / UserAvatar
// ============================================================

vi.mock("../../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/ChatContext", () => ({ useChat: vi.fn() }));
vi.mock("../../contexts/DailyContext", () => ({ useDaily: vi.fn() }));
vi.mock("../../contexts/DesktopContext", () => ({ useDesktop: vi.fn() }));
vi.mock("../atoms/UserAvatar", () => ({
  UserAvatar: () => <span data-testid="user-avatar" />
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChat = vi.mocked(useChat);
const mockedUseDaily = vi.mocked(useDaily);
const mockedUseDesktop = vi.mocked(useDesktop);

function makeUser(id = "u1", nickname = "用户"): UserProfile {
  return { id, nickname, avatarUrl: null, createdAt: "2026-01-01" };
}

function makePresenceUser(
  id = "u1",
  isOnline = true,
  nickname = "用户",
  moodEmoji: MoodEmoji | null = null
): PresenceUser {
  return {
    ...makeUser(id, nickname),
    isOnline,
    todayMood: moodEmoji
      ? { userId: id, moodDay: "2026-08-11", emoji: moodEmoji, updatedAt: "2026-08-11T00:00:00.000Z" }
      : null
  };
}

let selectMood: ReturnType<typeof vi.fn>;
let extraHeightSpy: ReturnType<typeof vi.fn>;

function mockDaily(overrides: Partial<Pick<DailyContextValue, "moodOptions" | "moodLoading">> = {}): void {
  mockedUseDaily.mockReturnValue({
    moodOptions: ["😊", "🥰"],
    moodLoading: false,
    selectMood,
    ...overrides
  } as unknown as DailyContextValue);
}

/** jsdom 没有 ResizeObserver，StatusBar 的额外高度汇报依赖它 */
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  selectMood = vi.fn().mockResolvedValue(undefined);
  extraHeightSpy = vi.fn();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);

  mockedUseAuth.mockReturnValue({ currentUserId: "u1" } as unknown as AuthContextValue);
  mockedUseChat.mockReturnValue({ presenceUsers: [] } as unknown as ChatContextValue);
  mockDaily();
  mockedUseDesktop.mockReturnValue({ desktopRole: "single" } as unknown as DesktopContextValue);

  (window as unknown as { xiaoelongDesktop: unknown }).xiaoelongDesktop = {
    isDesktop: true,
    setPanelContentExtraHeight: extraHeightSpy
  };
});

afterEach(() => {
  mockedUseAuth.mockReset();
  mockedUseChat.mockReset();
  mockedUseDaily.mockReset();
  mockedUseDesktop.mockReset();
  delete (window as unknown as { xiaoelongDesktop?: unknown }).xiaoelongDesktop;
  vi.unstubAllGlobals();
});

// ============================================================
// 正常路径
// ============================================================

describe("StatusBar 正常路径", () => {
  it("渲染用户列表：自己标我、今日心情显示 badge、在线/离线样式", () => {
    mockedUseChat.mockReturnValue({
      presenceUsers: [
        makePresenceUser("u1", true, "小明", "😊"),
        makePresenceUser("u2", false, "小红", null)
      ]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    expect(screen.getByText("小明")).toBeTruthy();
    expect(screen.getByText("我")).toBeTruthy();
    expect(screen.getByText("😊")).toBeTruthy();
    expect(screen.getByText("小红")).toBeTruthy();

    const items = document.querySelectorAll(".status-item");
    expect(items[0].classList.contains("online")).toBe(true);
    expect(items[1].classList.contains("offline")).toBe(true);
  });

  it("点击自己打开心情选择器，点击他人不打开", () => {
    mockedUseChat.mockReturnValue({
      presenceUsers: [
        makePresenceUser("u1", true, "小明", null),
        makePresenceUser("u2", false, "小红", null)
      ]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    // 点击他人：选择器不打开（无 emoji 选项按钮）
    fireEvent.click(screen.getByText("小红"));
    expect(screen.queryByRole("button", { name: "😊" })).toBeNull();

    // 点击自己：选择器打开
    fireEvent.click(screen.getByText("小明"));
    expect(screen.getByRole("button", { name: "😊" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "成员状态" })).toHaveClass("picker-open");
  });

  it("点选 emoji 调用 selectMood 并关闭选择器", () => {
    mockedUseChat.mockReturnValue({
      presenceUsers: [makePresenceUser("u1", true, "小明", null)]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    fireEvent.click(screen.getByText("小明"));
    fireEvent.click(screen.getByRole("button", { name: "😊" }));

    expect(selectMood).toHaveBeenCalledWith("😊");
    expect(screen.queryByRole("button", { name: "😊" })).toBeNull();
  });

  it("desktopRole=panel 时挂载即汇报面板额外高度（移入的 handleExtraHeight 逻辑）", () => {
    mockedUseDesktop.mockReturnValue({ desktopRole: "panel" } as unknown as DesktopContextValue);
    render(<StatusBar />);
    expect(extraHeightSpy).toHaveBeenCalled();
  });
});

// ============================================================
// 边界条件
// ============================================================

describe("StatusBar 边界条件", () => {
  it("用户列表为空时不渲染任何 status-item", () => {
    render(<StatusBar />);
    expect(document.querySelectorAll(".status-item").length).toBe(0);
  });

  it("desktopRole 非 panel 时不调用 setPanelContentExtraHeight", () => {
    render(<StatusBar />);
    expect(extraHeightSpy).not.toHaveBeenCalled();
  });
});

// ============================================================
// 错误路径
// ============================================================

describe("StatusBar 错误路径", () => {
  it("moodLoading 时选择器按钮禁用", () => {
    mockDaily({ moodLoading: true });
    mockedUseChat.mockReturnValue({
      presenceUsers: [makePresenceUser("u1", true, "小明", null)]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    fireEvent.click(screen.getByText("小明"));
    expect((screen.getByRole("button", { name: "😊" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// ============================================================
// 状态转换
// ============================================================

describe("StatusBar 状态转换", () => {
  it("Escape 关闭心情选择器", () => {
    mockedUseChat.mockReturnValue({
      presenceUsers: [makePresenceUser("u1", true, "小明", null)]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    fireEvent.click(screen.getByText("小明"));
    expect(screen.getByRole("button", { name: "😊" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "😊" })).toBeNull();
    expect(screen.getByRole("region", { name: "成员状态" })).not.toHaveClass("picker-open");
  });

  it("点击文档外部关闭心情选择器", () => {
    mockedUseChat.mockReturnValue({
      presenceUsers: [makePresenceUser("u1", true, "小明", null)]
    } as unknown as ChatContextValue);
    render(<StatusBar />);

    fireEvent.click(screen.getByText("小明"));
    expect(screen.getByRole("button", { name: "😊" })).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("button", { name: "😊" })).toBeNull();
  });
});
