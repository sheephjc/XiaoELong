// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../test-setup";
import { act, fireEvent, render } from "@testing-library/react";
import type { ChatMessage, PresenceUser } from "@xiaoelong/shared";
import { useAuth, type AuthContextValue } from "../../contexts/AuthContext";
import {
  useChat,
  type ChatContextValue,
  type ChatScrollMemory
} from "../../contexts/ChatContext";
import { ChatPanel } from "./ChatPanel";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/ChatContext", () => ({ useChat: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChat = vi.mocked(useChat);

const currentUser: PresenceUser = {
  id: "u1",
  nickname: "小明",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  isOnline: true,
  todayMood: null
};

const message: ChatMessage = {
  id: 1,
  user: currentUser,
  content: "最后一条消息",
  image: null,
  file: null,
  replyTo: null,
  createdAt: "2026-08-21T08:00:00.000Z"
};

let chatScrollHeight = 1000;
let chatClientHeight = 200;
let deferSmoothScroll = false;
let nextFrameId = 1;
let frameCallbacks = new Map<number, FrameRequestCallback>();
let resizeObservers: MockResizeObserver[] = [];
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

class MockResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function flushAnimationFrames(): void {
  while (frameCallbacks.size > 0) {
    const callbacks = Array.from(frameCallbacks.values());
    frameCallbacks = new Map();
    callbacks.forEach((callback) => callback(0));
  }
}

function makeScrollMemory(atBottom: boolean, scrollTop: number): ChatScrollMemory {
  return {
    scrollTop,
    atBottom,
    anchorMessageId: null,
    anchorOffset: 0,
    lastMessageId: message.id,
    firstUnreadMessageId: null,
    unreadCount: 0
  };
}

function mockContexts(scrollMemory: ChatScrollMemory): {
  scrollMemoryRef: { current: ChatScrollMemory | null };
  setMessages: (messages: ChatMessage[]) => void;
} {
  const scrollMemoryRef = { current: scrollMemory };
  mockedUseAuth.mockReturnValue({ currentUserId: currentUser.id } as AuthContextValue);
  let contextValue: ChatContextValue = {
    messages: [message],
    presenceUsers: [currentUser],
    sendError: null,
    socketError: null,
    historyInitialized: true,
    hasOlderMessages: false,
    loadingOlderMessages: false,
    olderMessagesError: null,
    loadOlderMessages: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    updateMoodForUser: vi.fn(),
    clear: vi.fn(),
    scrollMemoryRef
  };
  mockedUseChat.mockImplementation(() => contextValue);
  return {
    scrollMemoryRef,
    setMessages(messages) {
      contextValue = { ...contextValue, messages };
    }
  };
}

beforeEach(() => {
  chatScrollHeight = 1000;
  chatClientHeight = 200;
  deferSmoothScroll = false;
  nextFrameId = 1;
  frameCallbacks = new Map();
  resizeObservers = [];
  localStorage.clear();

  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("chat-list") ? chatScrollHeight : 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("chat-list") ? chatClientHeight : 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value(this: HTMLElement, options: ScrollToOptions | number, y?: number) {
      if (typeof options !== "number" && options.behavior === "smooth" && deferSmoothScroll) {
        return;
      }
      const requestedTop = typeof options === "number" ? (y ?? 0) : (options.top ?? this.scrollTop);
      this.scrollTop = Math.max(0, Math.min(requestedTop, this.scrollHeight - this.clientHeight));
    }
  });

  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    frameCallbacks.set(frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
    frameCallbacks.delete(frameId);
  });
});

afterEach(() => {
  mockedUseAuth.mockReset();
  mockedUseChat.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (originalScrollHeight) {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  }
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  }
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  }
});

describe("ChatPanel 底部位置恢复", () => {
  it("从其他面板返回后，内容高度变化时仍贴住最新消息", () => {
    const { scrollMemoryRef } = mockContexts(makeScrollMemory(true, 800));
    const { container } = render(<ChatPanel />);
    const list = container.querySelector<HTMLElement>(".chat-list");

    expect(list).not.toBeNull();
    expect(list?.scrollTop).toBe(800);

    chatScrollHeight = 1060;
    act(() => {
      resizeObservers[0]?.trigger();
      flushAnimationFrames();
    });

    expect(list?.scrollTop).toBe(860);
    expect(scrollMemoryRef.current?.scrollTop).toBe(860);
    expect(scrollMemoryRef.current?.atBottom).toBe(true);
  });

  it("用户已经向上翻阅时，内容高度变化不会把列表拉回底部", () => {
    mockContexts(makeScrollMemory(true, 800));
    const { container } = render(<ChatPanel />);
    const list = container.querySelector<HTMLElement>(".chat-list");

    expect(list).not.toBeNull();
    if (!list) {
      return;
    }

    list.scrollTop = 420;
    fireEvent.scroll(list);
    chatScrollHeight = 1060;
    act(() => {
      resizeObservers[0]?.trigger();
      flushAnimationFrames();
    });

    expect(list.scrollTop).toBe(420);
  });

  it("新消息正在平滑滚动时，用户上翻会取消自动跟随", () => {
    const nextMessage: ChatMessage = {
      ...message,
      id: 2,
      content: "刚发出的新消息"
    };
    const { setMessages } = mockContexts(makeScrollMemory(true, 800));
    const { container } = render(<ChatPanel />);
    const list = container.querySelector<HTMLElement>(".chat-list");
    const mentionButton = container.querySelector<HTMLButtonElement>(".chat-mention-button");

    expect(list).not.toBeNull();
    expect(mentionButton).not.toBeNull();
    if (!list || !mentionButton) {
      return;
    }

    deferSmoothScroll = true;
    chatScrollHeight = 1060;
    setMessages([message, nextMessage]);
    fireEvent.click(mentionButton);
    expect(list.scrollTop).toBe(800);

    fireEvent.wheel(list, { deltaY: -100 });
    list.scrollTop = 700;
    fireEvent.scroll(list);

    deferSmoothScroll = false;
    chatScrollHeight = 1120;
    act(() => {
      resizeObservers[0]?.trigger();
      flushAnimationFrames();
    });

    expect(list.scrollTop).toBe(700);
  });
});
