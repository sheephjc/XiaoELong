// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../test-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UserProfile } from "@xiaoelong/shared";
import { useAuth, type AuthContextValue } from "../../contexts/AuthContext";
import { useChat, type ChatContextValue } from "../../contexts/ChatContext";
import { useDeity, type DeityContextValue } from "../../contexts/DeityContext";
import { useDesktop, type DesktopContextValue } from "../../contexts/DesktopContext";
import { getBirthdaySeenStorageKey } from "../../utils/birthday-celebration";
import { PanelContent } from "./PanelContent";

// ============================================================
// Mock 依赖：4 个 Context + 6 个 panels 子组件
// ============================================================

vi.mock("../../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/ChatContext", () => ({ useChat: vi.fn() }));
vi.mock("../../contexts/DeityContext", () => ({ useDeity: vi.fn() }));
vi.mock("../../contexts/DesktopContext", () => ({ useDesktop: vi.fn() }));

vi.mock("../panels/StatusBar", () => ({ StatusBar: () => <div data-testid="status-bar" /> }));
vi.mock("../atoms/PetSprite", () => ({
  PetSprite: ({ displayMode }: { displayMode: string }) => <div data-testid="pet-preview">{displayMode}</div>
}));
vi.mock("../panels/ChatPanel", () => ({ ChatPanel: () => <div data-testid="chat-panel" /> }));
vi.mock("../panels/DailyQuestionPanel", () => ({
  DailyQuestionPanel: () => <div data-testid="daily-panel" />
}));
vi.mock("../panels/DivineSelectionPanel", () => ({
  DivineSelectionPanel: () => <div data-testid="divine-panel" />
}));
vi.mock("../panels/GomokuPanel", () => ({ GomokuPanel: () => <div data-testid="gomoku-panel" /> }));
vi.mock("../panels/SettingsProfileForm", () => ({
  SettingsProfileForm: () => <div data-testid="settings-form" />
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChat = vi.mocked(useChat);
const mockedUseDeity = vi.mocked(useDeity);
const mockedUseDesktop = vi.mocked(useDesktop);

function makeUser(id = "u1", nickname = "小明"): UserProfile {
  return { id, nickname, avatarUrl: null, createdAt: "2026-01-01" };
}

let setActiveTab: ReturnType<typeof vi.fn>;
let selectDivineTab: ReturnType<typeof vi.fn>;
let deleteAccount: ReturnType<typeof vi.fn>;
let setDetailsOpen: ReturnType<typeof vi.fn>;
let setDeleteConfirmOpen: ReturnType<typeof vi.fn>;
let hideAllWindows: ReturnType<typeof vi.fn>;
let toggleLoginAtStartup: ReturnType<typeof vi.fn>;
let setColorTheme: ReturnType<typeof vi.fn>;
let setPanelLayout: ReturnType<typeof vi.fn>;
let setPetDisplayMode: ReturnType<typeof vi.fn>;
let cyclePetDisplayMode: ReturnType<typeof vi.fn>;

/** 只 mock PanelContent 用到的字段，其余用类型断言占位 */
function mockDesktop(overrides: Partial<DesktopContextValue> = {}): void {
  mockedUseDesktop.mockReturnValue({
    activeTab: "chat",
    panelView: "home",
    deleteConfirmOpen: false,
    detailsOpen: false,
    desktopSettings: {
      openAtLogin: false,
      panelAlwaysOnTop: false,
      colorTheme: "melonStone",
      panelLayout: "classic",
      petDisplayMode: "dynamic",
      petAnimationsEnabled: true,
      petDisplayModePersisted: true
    },
    updateState: { status: "idle", message: "", version: "0.0.0", progress: null, manual: false },
    setActiveTab,
    setDetailsOpen,
    setDeleteConfirmOpen,
    hideAllWindows,
    toggleLoginAtStartup,
    togglePanelTopmost: vi.fn(),
    setColorTheme,
    setPanelLayout,
    setPetDisplayMode,
    cyclePetDisplayMode,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    ...overrides
  } as unknown as DesktopContextValue);
}

function mockAuth(overrides: Partial<AuthContextValue> = {}): void {
  mockedUseAuth.mockReturnValue({
    currentUser: makeUser(),
    accountDeleting: false,
    deleteAccount,
    ...overrides
  } as unknown as AuthContextValue);
}

beforeEach(() => {
  localStorage.clear();
  setActiveTab = vi.fn();
  selectDivineTab = vi.fn();
  deleteAccount = vi.fn().mockResolvedValue(undefined);
  setDetailsOpen = vi.fn();
  setDeleteConfirmOpen = vi.fn();
  hideAllWindows = vi.fn();
  toggleLoginAtStartup = vi.fn();
  setColorTheme = vi.fn().mockResolvedValue(undefined);
  setPanelLayout = vi.fn().mockResolvedValue(undefined);
  setPetDisplayMode = vi.fn().mockResolvedValue(undefined);
  cyclePetDisplayMode = vi.fn().mockResolvedValue(undefined);
  mockDesktop();
  mockAuth();
  mockedUseChat.mockReturnValue({ socketError: null } as unknown as ChatContextValue);
  mockedUseDeity.mockReturnValue({ selectDivineTab } as unknown as DeityContextValue);
});

afterEach(() => {
  vi.useRealTimers();
  mockedUseAuth.mockReset();
  mockedUseChat.mockReset();
  mockedUseDeity.mockReset();
  mockedUseDesktop.mockReset();
});

// ============================================================
// 正常路径
// ============================================================

describe("PanelContent 正常路径", () => {
  it("有用户时渲染 homePanel：topbar + 4 个 tab 按钮", () => {
    render(<PanelContent />);
    expect(screen.getByRole("heading", { level: 1, name: "小鳄龙之家" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "聊天" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "每日一题" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "神选" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "五子棋" })).toBeTruthy();
  });

  it("默认 activeTab=chat 渲染 ChatPanel，其他面板不渲染", () => {
    render(<PanelContent />);
    expect(screen.getByTestId("chat-panel")).toBeTruthy();
    expect(screen.queryByTestId("daily-panel")).toBeNull();
    expect(screen.queryByTestId("gomoku-panel")).toBeNull();
  });

  it("panelView=settings 时渲染 settingsPanel", () => {
    mockDesktop({ panelView: "settings" });
    render(<PanelContent />);
    expect(screen.getByTestId("settings-form")).toBeTruthy();
    expect(screen.getByRole("button", { name: "隐藏小鳄龙" })).toBeTruthy();
  });
});

// ============================================================
// 边界条件
// ============================================================

describe("PanelContent 边界条件", () => {
  it("currentUser 为 null 时返回 null（守卫，放所有 hook 后）", () => {
    mockAuth({ currentUser: null });
    const { container } = render(<PanelContent />);
    expect(container.firstChild).toBeNull();
  });

  it("socketError 无值时不渲染 connection-toast", () => {
    render(<PanelContent />);
    expect(document.querySelector(".connection-toast")).toBeNull();
  });

  it("socketError 有值时渲染 connection-toast 与文案", () => {
    mockedUseChat.mockReturnValue({ socketError: "连接断开" } as unknown as ChatContextValue);
    render(<PanelContent />);
    expect(document.querySelector(".connection-toast")).toBeTruthy();
    expect(screen.getByText("连接断开")).toBeTruthy();
  });
});

// ============================================================
// 状态转换
// ============================================================

describe("PanelContent 状态转换", () => {
  it("生日当天优先展示祝福，关闭并重开后只保留面板内特效", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10));

    const firstRender = render(<PanelContent />);
    expect(screen.getByRole("dialog", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeTruthy();
    expect(document.querySelector(".birthday-panel-effects")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelectorAll(".birthday-panel-ribbons i")).toHaveLength(18);
    expect(document.querySelectorAll(".birthday-panel-cakes i")).toHaveLength(5);
    expect(document.querySelectorAll(".birthday-panel-firework")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "开心收下 🎉" }));
    expect(screen.queryByRole("dialog", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeNull();
    expect(localStorage.getItem(getBirthdaySeenStorageKey("2026-08-24"))).toBe("seen");
    expect(screen.getByRole("status", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeTruthy();

    firstRender.unmount();
    render(<PanelContent />);
    expect(screen.queryByRole("dialog", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeNull();
    expect(screen.getByRole("status", { name: "祝郭生日快乐！🥳🥳🥳" })).toBeTruthy();
  });

  it("点'每日一题'tab 调 setActiveTab('daily')", () => {
    render(<PanelContent />);
    fireEvent.click(screen.getByRole("button", { name: "每日一题" }));
    expect(setActiveTab).toHaveBeenCalledWith("daily");
  });

  it("点'神选'tab 调 selectDivineTab", () => {
    render(<PanelContent />);
    fireEvent.click(screen.getByRole("button", { name: "神选" }));
    expect(selectDivineTab).toHaveBeenCalledTimes(1);
  });

  it("detailsOpen 时渲染详情弹窗，点关闭调 setDetailsOpen(false)", () => {
    mockDesktop({ panelView: "settings", detailsOpen: true });
    render(<PanelContent />);
    expect(screen.getByRole("dialog", { name: "项目详情" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(setDetailsOpen).toHaveBeenCalledWith(false);
  });

  it("外观弹层展示多套配色，选择后调用 setColorTheme", () => {
    mockDesktop({ panelView: "settings" });
    render(<PanelContent />);

    fireEvent.click(screen.getByRole("button", { name: "外观" }));
    expect(screen.getByRole("dialog", { name: "外观设置" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "配色" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "布局" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "形象" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /奶蜜浅石/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /柔柠雾霾/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /雾桃柔靛/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /柔橙烟雾/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /浅奶柔灰/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /柔柠雾霾/ }));
    expect(setColorTheme).toHaveBeenCalledWith("lemonMist");
  });

  it("外观布局页可切换郭之布局，形象页承接原显示方式切换", () => {
    mockDesktop({ panelView: "settings" });
    render(<PanelContent />);

    expect(screen.queryByRole("button", { name: /小鳄龙显示方式/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "外观" }));
    fireEvent.click(screen.getByRole("tab", { name: "布局" }));
    expect(screen.getByRole("button", { name: /原始布局/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /郭之布局/ }));
    expect(setPanelLayout).toHaveBeenCalledWith("guo");

    fireEvent.click(screen.getByRole("tab", { name: "形象" }));
    expect(screen.getByLabelText("动态交互预览")).toBeTruthy();
    expect(screen.getByTestId("pet-preview")).toHaveTextContent("dynamic");
    fireEvent.click(screen.getByRole("button", { name: "上一个形象" }));
    expect(setPetDisplayMode).toHaveBeenCalledWith("image");
    fireEvent.click(screen.getByRole("button", { name: "下一个形象" }));
    expect(setPetDisplayMode).toHaveBeenCalledWith("static");

    fireEvent.click(screen.getByRole("button", { name: "关闭外观设置" }));
    expect(screen.queryByRole("dialog", { name: "外观设置" })).toBeNull();
  });

  it("郭之布局保留四个模块的可访问名称并应用布局类", () => {
    mockDesktop({
      desktopSettings: {
        openAtLogin: false,
        panelAlwaysOnTop: false,
        colorTheme: "melonStone",
        panelLayout: "guo",
        petDisplayMode: "dynamic",
        petAnimationsEnabled: true,
        petDisplayModePersisted: true
      }
    });
    const { container } = render(<PanelContent />);

    expect(container.querySelector(".panel-layout-guo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "聊天" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "每日一题" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "神选" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "五子棋" })).toBeTruthy();
    expect(container.querySelectorAll(".module-tab-icon")).toHaveLength(4);
  });

  it("deleteConfirmOpen 时渲染注销确认弹窗，点'确定'调 deleteAccount", () => {
    mockDesktop({ panelView: "settings", deleteConfirmOpen: true });
    render(<PanelContent />);
    expect(screen.getByRole("dialog", { name: "确认注销" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// 错误路径
// ============================================================

describe("PanelContent 错误路径", () => {
  it("accountDeleting 时注销按钮禁用且文案为'注销中'", () => {
    mockDesktop({ panelView: "settings" });
    mockAuth({ accountDeleting: true });
    render(<PanelContent />);
    expect(screen.getByRole("button", { name: "注销中" })).toBeDisabled();
  });

  it("点'隐藏小鳄龙'调 hideAllWindows", () => {
    mockDesktop({ panelView: "settings" });
    render(<PanelContent />);
    fireEvent.click(screen.getByRole("button", { name: "隐藏小鳄龙" }));
    expect(hideAllWindows).toHaveBeenCalledTimes(1);
  });
});
