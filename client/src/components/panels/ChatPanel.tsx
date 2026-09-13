import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ChatFile, ChatMessage } from "@xiaoelong/shared";
import { formatChatTimestamp } from "../../utils/chat-time";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import type { ChatScrollMemory } from "../../contexts/ChatContext";
import { withServerUrl } from "../../config/env";
import { UserAvatar } from "../atoms/UserAvatar";

const ALLOWED_CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const BLOCKED_CHAT_FILE_EXTENSIONS = [".exe", ".bat", ".cmd", ".msi", ".ps1", ".js", ".vbs", ".scr", ".com"];
const CHAT_LAST_READ_MESSAGE_STORAGE_PREFIX = "xiaoelong_chat_last_read_message_";
const CHAT_MENTION_ACK_STORAGE_PREFIX = "xiaoelong_chat_mention_ack_";

function getLastReadMessageStorageKey(userId: string): string {
  return `${CHAT_LAST_READ_MESSAGE_STORAGE_PREFIX}${userId}`;
}

function readLastReadMessageId(userId: string | null): number | null {
  if (!userId) {
    return null;
  }
  try {
    const value = Number(localStorage.getItem(getLastReadMessageStorageKey(userId)));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistLastReadMessageId(userId: string | null, messageId: number): void {
  if (!userId) {
    return;
  }
  try {
    const previousMessageId = readLastReadMessageId(userId) ?? 0;
    if (messageId > previousMessageId) {
      localStorage.setItem(getLastReadMessageStorageKey(userId), String(messageId));
    }
  } catch {
    // 本地存储不可用时仍允许正常使用聊天，只是不保留跨重启的已读位置。
  }
}

function readMentionAckMessageId(userId: string | null): number | null {
  if (!userId) {
    return null;
  }
  try {
    const storedValue = localStorage.getItem(`${CHAT_MENTION_ACK_STORAGE_PREFIX}${userId}`);
    if (storedValue === null) {
      return null;
    }
    const value = Number(storedValue);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function persistMentionAckMessageId(userId: string | null, messageId: number): void {
  if (!userId) {
    return;
  }
  try {
    localStorage.setItem(`${CHAT_MENTION_ACK_STORAGE_PREFIX}${userId}`, String(messageId));
  } catch {
    // 本地存储不可用时，提及提醒仍在当前挂载期间正常工作。
  }
}

function getExtensionForImageType(type: string): string {
  if (type === "image/jpeg") {
    return ".jpg";
  }
  if (type === "image/png") {
    return ".png";
  }
  if (type === "image/webp") {
    return ".webp";
  }
  if (type === "image/gif") {
    return ".gif";
  }
  return ".png";
}

function isAllowedImageFile(file: File): boolean {
  return ALLOWED_CHAT_IMAGE_TYPES.includes(file.type);
}

function isBlockedFileName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return BLOCKED_CHAT_FILE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }
  return `${size} B`;
}

function validateImageFile(file: File): string | null {
  if (!isAllowedImageFile(file)) {
    return "请选择 jpg、png、webp 或 gif 图片。";
  }

  if (file.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
    return "图片不能超过 5MB。";
  }

  if (file.size <= 0) {
    return "图片不能为空。";
  }

  return null;
}

function validateAttachmentFile(file: File): string | null {
  if (file.type.startsWith("image/")) {
    return validateImageFile(file);
  }

  if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
    return "文件不能超过 50MB。";
  }

  if (file.size <= 0) {
    return "文件不能为空。";
  }

  if (isBlockedFileName(file.name)) {
    return "该文件类型暂不支持发送。";
  }

  return null;
}

function normalizeClipboardImageFile(file: File): File {
  const type = file.type || "image/png";
  const name = file.name || `pasted-image-${Date.now()}${getExtensionForImageType(type)}`;
  if (file.name && file.type) {
    return file;
  }

  return new File([file], name, {
    type,
    lastModified: Date.now()
  });
}

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function getMessagePreview(message: Pick<ChatMessage, "content" | "image" | "file">): string {
  const text = message.content.trim();
  if (text) {
    return text;
  }
  if (message.image) {
    return `[图片] ${message.image.name}`;
  }
  if (message.file) {
    return `[文件] ${message.file.name}`;
  }
  return "消息";
}

export const ChatPanel = memo(function ChatPanel(): JSX.Element {
  const { currentUserId } = useAuth();
  const {
    messages,
    presenceUsers,
    sendError,
    historyInitialized,
    hasOlderMessages,
    loadingOlderMessages,
    olderMessagesError,
    loadOlderMessages,
    scrollMemoryRef,
    sendMessage: onSendMessage
  } = useChat();
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileFile, setFileFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [hiddenUnreadCount, setHiddenUnreadCount] = useState(0);
  const [startupUnreadCount, setStartupUnreadCount] = useState(0);
  const [liveNewMessageCount, setLiveNewMessageCount] = useState(0);
  const [unreadJumpDirection, setUnreadJumpDirection] = useState<"up" | "down">("up");
  const [replyToMessageId, setReplyToMessageId] = useState<number | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionAll, setMentionAll] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listContentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composeInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef<number | null>(null);
  const firstUnreadMessageIdRef = useRef<number | null>(null);
  const firstStartupUnreadMessageIdRef = useRef<number | null>(null);
  const unreadCountRef = useRef(0);
  const firstLiveNewMessageIdRef = useRef<number | null>(null);
  const liveNewMessageCountRef = useRef(0);
  const hasRestoredScrollRef = useRef(false);
  const isScrollingToBottomRef = useRef(false);
  const restoreFrameRef = useRef<number | null>(null);
  const startupFrameRef = useRef<number | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const coldStartScrollRef = useRef(scrollMemoryRef.current === null);
  const startupLastReadMessageIdRef = useRef(
    scrollMemoryRef.current === null ? readLastReadMessageId(currentUserId) : null
  );
  const startupLatestMessageIdRef = useRef<number | null>(null);
  const startupBaselineInitializedRef = useRef(false);
  const startupBottomPendingRef = useRef(scrollMemoryRef.current === null);
  const olderHistoryAnchorRef = useRef<{ messageId: number; offset: number } | null>(null);
  const storedMentionAckMessageIdRef = useRef(
    readMentionAckMessageId(currentUserId) ?? readLastReadMessageId(currentUserId)
  );
  const mentionAckInitializedRef = useRef(storedMentionAckMessageIdRef.current !== null);
  const [mentionAckMessageId, setMentionAckMessageId] = useState(storedMentionAckMessageIdRef.current);
  const panelVisibleRef = useRef(
    window.xiaoelongDesktop?.role === "panel"
      ? (window.xiaoelongDesktop.getPanelVisibility?.() ?? document.visibilityState === "visible")
      : true
  );

  const renderedMessages = useMemo(() => messages, [messages]);
  const mentionableUsers = useMemo(
    () => presenceUsers.filter((user) => user.id !== currentUserId),
    [presenceUsers, currentUserId]
  );
  const mentionedUsers = useMemo(
    () => mentionedUserIds
      .map((userId) => presenceUsers.find((user) => user.id === userId))
      .filter((user): user is NonNullable<typeof user> => Boolean(user)),
    [mentionedUserIds, presenceUsers]
  );
  const pendingMentionMessages = useMemo(
    () => mentionAckMessageId === null || !currentUserId
      ? []
      : renderedMessages.filter((message) =>
          message.id > mentionAckMessageId
          && message.user.id !== currentUserId
          && (Boolean(message.mentionAll) || Boolean(message.mentionedUserIds?.includes(currentUserId)))
        ),
    [renderedMessages, mentionAckMessageId, currentUserId]
  );
  const replyToMessage = useMemo(
    () => renderedMessages.find((message) => message.id === replyToMessageId) ?? null,
    [renderedMessages, replyToMessageId]
  );
  const renderedMessageIds = useMemo(
    () => new Set(renderedMessages.map((message) => message.id)),
    [renderedMessages]
  );
  const renderedMessagesRef = useRef(renderedMessages);
  renderedMessagesRef.current = renderedMessages;
  const knownMessageIdsRef = useRef<Set<number>>(new Set());
  const oldestMessageIdRef = useRef<number | null>(renderedMessages[0]?.id ?? null);
  const imageMessages = useMemo(
    () =>
      renderedMessages.flatMap((message) =>
        message.image
          ? [
              {
                messageId: message.id,
                image: message.image,
                userNickname: message.user.nickname,
                url: withServerUrl(message.image.url) ?? message.image.url
              }
            ]
          : []
      ),
    [renderedMessages]
  );
  const activeImage = viewerIndex === null ? null : imageMessages[viewerIndex] ?? null;

  useEffect(() => {
    if (mentionAckInitializedRef.current || !historyInitialized) {
      return;
    }
    mentionAckInitializedRef.current = true;
    const baselineMessageId = renderedMessages[renderedMessages.length - 1]?.id ?? 0;
    persistMentionAckMessageId(currentUserId, baselineMessageId);
    setMentionAckMessageId(baselineMessageId);
  }, [historyInitialized, renderedMessages, currentUserId]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  useEffect(() => {
    if (replyToMessageId !== null && !replyToMessage) {
      setReplyToMessageId(null);
    }
  }, [replyToMessageId, replyToMessage]);

  useEffect(() => () => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  function getMessageElement(messageId: number): HTMLElement | null {
    return listRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`) ?? null;
  }

  function isMessageVisible(messageId: number): boolean {
    if (!panelVisibleRef.current) {
      return false;
    }
    const list = listRef.current;
    const messageElement = getMessageElement(messageId);
    if (!list || !messageElement) {
      return false;
    }

    const listBounds = list.getBoundingClientRect();
    const messageBounds = messageElement.getBoundingClientRect();
    const visibleHeight = Math.max(
      0,
      Math.min(messageBounds.bottom, listBounds.bottom) - Math.max(messageBounds.top, listBounds.top)
    );
    const requiredVisibleHeight = Math.min(24, Math.max(1, messageBounds.height));
    return visibleHeight >= requiredVisibleHeight;
  }

  function acknowledgeVisibleChatNotices(): void {
    if (!panelVisibleRef.current) {
      return;
    }

    const latestVisibleMentionId = pendingMentionMessages.reduce<number | null>(
      (latestId, message) => isMessageVisible(message.id) ? Math.max(latestId ?? 0, message.id) : latestId,
      null
    );
    if (latestVisibleMentionId !== null && latestVisibleMentionId > (mentionAckMessageId ?? 0)) {
      persistMentionAckMessageId(currentUserId, latestVisibleMentionId);
      setMentionAckMessageId(latestVisibleMentionId);
    }

    let clearedUnreadNotice = false;
    const firstStartupUnreadMessageId = firstStartupUnreadMessageIdRef.current;
    if (firstStartupUnreadMessageId !== null && isMessageVisible(firstStartupUnreadMessageId)) {
      firstStartupUnreadMessageIdRef.current = null;
      startupLastReadMessageIdRef.current = null;
      setStartupUnreadCount(0);
      clearedUnreadNotice = true;
    }
    const firstHiddenUnreadMessageId = firstUnreadMessageIdRef.current;
    if (firstHiddenUnreadMessageId !== null && isMessageVisible(firstHiddenUnreadMessageId)) {
      setHiddenUnreadState(null, 0);
      clearedUnreadNotice = true;
    }
    const firstLiveNewMessageId = firstLiveNewMessageIdRef.current;
    if (firstLiveNewMessageId !== null && isMessageVisible(firstLiveNewMessageId)) {
      setLiveNewMessageState(null, 0);
      clearedUnreadNotice = true;
    }

    if (latestVisibleMentionId !== null || clearedUnreadNotice) {
      window.xiaoelongDesktop?.setTrayUnread?.(false);
    }
  }

  function updateUnreadJumpDirection(): void {
    const targetMessageId = firstStartupUnreadMessageIdRef.current ?? firstUnreadMessageIdRef.current;
    const list = listRef.current;
    const targetElement = targetMessageId === null ? null : getMessageElement(targetMessageId);
    if (!list || !targetElement) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const targetBounds = targetElement.getBoundingClientRect();
    setUnreadJumpDirection(targetBounds.bottom <= listBounds.top ? "up" : "down");
  }

  function refreshVisibleChatNotices(): void {
    acknowledgeVisibleChatNotices();
    updateUnreadJumpDirection();
  }

  function setHiddenUnreadState(firstUnreadMessageId: number | null, unreadCount: number): void {
    const normalizedCount = firstUnreadMessageId === null ? 0 : Math.max(0, unreadCount);
    firstUnreadMessageIdRef.current = normalizedCount > 0 ? firstUnreadMessageId : null;
    unreadCountRef.current = normalizedCount;
    setHiddenUnreadCount(normalizedCount);

    const memory = scrollMemoryRef.current;
    if (memory) {
      scrollMemoryRef.current = {
        ...memory,
        firstUnreadMessageId: firstUnreadMessageIdRef.current,
        unreadCount: normalizedCount
      };
    }
  }

  function setLiveNewMessageState(firstMessageId: number | null, messageCount: number): void {
    const normalizedCount = firstMessageId === null ? 0 : Math.max(0, messageCount);
    firstLiveNewMessageIdRef.current = normalizedCount > 0 ? firstMessageId : null;
    liveNewMessageCountRef.current = normalizedCount;
    setLiveNewMessageCount(normalizedCount);
  }

  function markLatestMessageRead(): void {
    if (!panelVisibleRef.current) {
      return;
    }
    const latestMessage = renderedMessagesRef.current[renderedMessagesRef.current.length - 1];
    if (latestMessage) {
      persistLastReadMessageId(currentUserId, latestMessage.id);
      window.xiaoelongDesktop?.setTrayUnread?.(false);
    }
  }

  function captureScrollMemory(): void {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const messageElements = Array.from(list.querySelectorAll<HTMLElement>("[data-message-id]"));
    const anchorElement = messageElements.find((element) => element.getBoundingClientRect().bottom > listBounds.top);
    const anchorMessageId = anchorElement ? Number(anchorElement.dataset.messageId) : null;
    const anchorOffset = anchorElement ? anchorElement.getBoundingClientRect().top - listBounds.top : 0;
    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const atBottom = unreadCountRef.current === 0
      && liveNewMessageCountRef.current === 0
      && (isScrollingToBottomRef.current || distanceToBottom <= 28);
    const latestMessage = renderedMessagesRef.current[renderedMessagesRef.current.length - 1] ?? null;

    isAtBottomRef.current = atBottom;
    scrollMemoryRef.current = {
      scrollTop: list.scrollTop,
      atBottom,
      anchorMessageId: Number.isFinite(anchorMessageId) ? anchorMessageId : null,
      anchorOffset,
      lastMessageId: lastMessageIdRef.current ?? latestMessage?.id ?? null,
      firstUnreadMessageId: firstUnreadMessageIdRef.current,
      unreadCount: unreadCountRef.current
    };
  }

  function restoreScrollPosition(memory: ChatScrollMemory): void {
    const list = listRef.current;
    if (!list) {
      return;
    }

    isScrollingToBottomRef.current = false;
    const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
    list.scrollTop = Math.max(0, Math.min(memory.scrollTop, maxScrollTop));

    if (memory.anchorMessageId === null) {
      return;
    }

    const anchorElement = getMessageElement(memory.anchorMessageId);
    if (!anchorElement) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const anchorOffset = anchorElement.getBoundingClientRect().top - listBounds.top;
    list.scrollTop += anchorOffset - memory.anchorOffset;
  }

  function scrollToBottom(behavior: ScrollBehavior = "auto"): void {
    const list = listRef.current;
    if (!list) {
      return;
    }
    list.scrollTo({
      top: list.scrollHeight,
      behavior
    });
    isScrollingToBottomRef.current = behavior === "smooth";
    isAtBottomRef.current = true;
    setHiddenUnreadState(null, 0);
    setLiveNewMessageState(null, 0);
    markLatestMessageRead();
  }

  function scheduleScrollToBottomAfterLayout(): void {
    if (startupFrameRef.current !== null) {
      window.cancelAnimationFrame(startupFrameRef.current);
    }

    scrollToBottom("auto");
    captureScrollMemory();
    startupFrameRef.current = window.requestAnimationFrame(() => {
      startupFrameRef.current = window.requestAnimationFrame(() => {
        startupFrameRef.current = null;
        scrollToBottom("auto");
        captureScrollMemory();
      });
    });
  }

  function scrollToFirstHiddenUnread(): void {
    const list = listRef.current;
    const firstUnreadMessageId = firstUnreadMessageIdRef.current;
    if (!list || firstUnreadMessageId === null) {
      return;
    }

    isScrollingToBottomRef.current = false;
    const firstUnreadElement = getMessageElement(firstUnreadMessageId);
    if (!firstUnreadElement) {
      scrollToBottom("smooth");
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const targetTop = list.scrollTop + firstUnreadElement.getBoundingClientRect().top - listBounds.top - 8;
    list.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
    window.requestAnimationFrame(() => {
      refreshVisibleChatNotices();
      captureScrollMemory();
    });
  }

  function scrollToFirstStartupUnread(): void {
    const list = listRef.current;
    const firstUnreadMessageId = firstStartupUnreadMessageIdRef.current;
    if (!list || firstUnreadMessageId === null) {
      return;
    }

    const lastReadMessageId = startupLastReadMessageIdRef.current;
    const oldestMessageId = renderedMessagesRef.current[0]?.id ?? null;
    const isStillLocatingFirstUnread = lastReadMessageId !== null
      && oldestMessageId !== null
      && oldestMessageId > lastReadMessageId
      && hasOlderMessages;
    if (isStillLocatingFirstUnread) {
      if (!loadingOlderMessages) {
        void loadOlderMessages();
      }
      return;
    }

    isScrollingToBottomRef.current = false;
    const firstUnreadElement = getMessageElement(firstUnreadMessageId);
    if (!firstUnreadElement) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const targetTop = list.scrollTop + firstUnreadElement.getBoundingClientRect().top - listBounds.top - 8;
    list.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
    window.requestAnimationFrame(() => {
      refreshVisibleChatNotices();
      captureScrollMemory();
    });
  }

  function scrollToFirstLiveNewMessage(): void {
    const list = listRef.current;
    const firstMessageId = firstLiveNewMessageIdRef.current;
    if (!list || firstMessageId === null) {
      return;
    }

    isScrollingToBottomRef.current = false;
    const firstMessageElement = getMessageElement(firstMessageId);
    if (!firstMessageElement) {
      scrollToBottom("smooth");
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const targetTop = list.scrollTop + firstMessageElement.getBoundingClientRect().top - listBounds.top - 8;
    list.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
    window.requestAnimationFrame(() => {
      refreshVisibleChatNotices();
      captureScrollMemory();
    });
  }

  function beginReply(messageId: number): void {
    setReplyToMessageId(messageId);
    window.requestAnimationFrame(() => {
      composeInputRef.current?.focus({ preventScroll: true });
    });
  }

  function toggleMentionAll(): void {
    setMentionAll((selected) => !selected);
    setMentionedUserIds([]);
  }

  function toggleMentionUser(userId: string): void {
    setMentionAll(false);
    setMentionedUserIds((current) => current.includes(userId)
      ? current.filter((mentionedUserId) => mentionedUserId !== userId)
      : [...current, userId]);
  }

  function scrollToNextMention(): void {
    const message = pendingMentionMessages[0];
    if (!message) {
      return;
    }
    scrollToQuotedMessage(message.id);
    window.requestAnimationFrame(refreshVisibleChatNotices);
  }

  function scrollToQuotedMessage(messageId: number): void {
    const list = listRef.current;
    const messageElement = getMessageElement(messageId);
    if (!list || !messageElement) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const targetTop = list.scrollTop + messageElement.getBoundingClientRect().top - listBounds.top
      - Math.max(8, (list.clientHeight - messageElement.offsetHeight) / 2);
    list.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });

    setHighlightedMessageId(messageId);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1600);
  }

  function updateBottomState(): void {
    const list = listRef.current;
    if (!list) {
      return;
    }

    if (loadingOlderMessages && olderHistoryAnchorRef.current) {
      const listBounds = list.getBoundingClientRect();
      const visibleMessageElement = Array.from(
        list.querySelectorAll<HTMLElement>("[data-message-id]")
      ).find((element) => element.getBoundingClientRect().bottom > listBounds.top);
      const visibleMessageId = visibleMessageElement
        ? Number(visibleMessageElement.dataset.messageId)
        : Number.NaN;
      if (visibleMessageElement && Number.isSafeInteger(visibleMessageId)) {
        olderHistoryAnchorRef.current = {
          messageId: visibleMessageId,
          offset: visibleMessageElement.getBoundingClientRect().top - listBounds.top
        };
      }
    }

    if (list.scrollTop <= 28 && hasOlderMessages && !loadingOlderMessages) {
      const firstMessage = renderedMessagesRef.current[0];
      const firstMessageElement = firstMessage ? getMessageElement(firstMessage.id) : null;
      if (firstMessage && firstMessageElement) {
        const listBounds = list.getBoundingClientRect();
        olderHistoryAnchorRef.current = {
          messageId: firstMessage.id,
          offset: firstMessageElement.getBoundingClientRect().top - listBounds.top
        };
      }
      void loadOlderMessages();
    }

    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isAtBottom = distanceToBottom <= 28;
    if (isAtBottom) {
      isScrollingToBottomRef.current = false;
    }
    isAtBottomRef.current = isScrollingToBottomRef.current || isAtBottom;
    if (isAtBottom) {
      setHiddenUnreadState(null, 0);
      setLiveNewMessageState(null, 0);
      markLatestMessageRead();
    }
    refreshVisibleChatNotices();
    captureScrollMemory();
  }

  function cancelPendingScrollToBottom(): void {
    isScrollingToBottomRef.current = false;
  }

  useEffect(() => {
    function handlePanelVisibility(visible: boolean): void {
      panelVisibleRef.current = visible;
      if (!visible) {
        captureScrollMemory();
        return;
      }

      const shouldRestoreBottom = unreadCountRef.current === 0
        && liveNewMessageCountRef.current === 0
        && (
          startupBottomPendingRef.current
          || isAtBottomRef.current
          || scrollMemoryRef.current?.atBottom === true
        );
      startupBottomPendingRef.current = false;
      if (shouldRestoreBottom) {
        isAtBottomRef.current = true;
        scheduleScrollToBottomAfterLayout();
      }
      window.requestAnimationFrame(refreshVisibleChatNotices);
    }

    const desktopCleanup = window.xiaoelongDesktop?.onPanelVisibilityChange?.(handlePanelVisibility);
    const handleDocumentVisibility = (): void => {
      if (window.xiaoelongDesktop?.role !== "panel") {
        handlePanelVisibility(document.visibilityState === "visible");
      }
    };
    document.addEventListener("visibilitychange", handleDocumentVisibility);

    return () => {
      desktopCleanup?.();
      document.removeEventListener("visibilitychange", handleDocumentVisibility);
    };
  }, [scrollMemoryRef]);

  function openImageViewer(messageId: number): void {
    const nextIndex = imageMessages.findIndex((item) => item.messageId === messageId);
    if (nextIndex !== -1) {
      if (window.xiaoelongDesktop?.openImageViewer) {
        window.xiaoelongDesktop.openImageViewer({
          images: imageMessages.map((item) => ({
            url: item.url,
            name: item.image.name,
            userNickname: item.userNickname
          })),
          index: nextIndex
        });
        return;
      }

      setViewerIndex(nextIndex);
    }
  }

  function showPreviousImage(): void {
    if (imageMessages.length === 0) {
      return;
    }
    setViewerIndex((current) => (current === null ? 0 : (current - 1 + imageMessages.length) % imageMessages.length));
  }

  function showNextImage(): void {
    if (imageMessages.length === 0) {
      return;
    }
    setViewerIndex((current) => (current === null ? 0 : (current + 1) % imageMessages.length));
  }

  async function downloadChatFile(file: ChatFile): Promise<void> {
    const url = withServerUrl(file.url) ?? file.url;
    setAttachmentError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Download failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setAttachmentError("文件下载失败，请稍后重试。");
    }
  }

  function handleRenderedImageLoad(): void {
    window.requestAnimationFrame(() => {
      if (isAtBottomRef.current) {
        scrollToBottom("auto");
        captureScrollMemory();
        return;
      }

      const memory = scrollMemoryRef.current;
      if (memory) {
        restoreScrollPosition(memory);
        updateBottomState();
      }
    });
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    const content = listContentRef.current;
    if (!list || !content || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!isAtBottomRef.current) {
        return;
      }

      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
      layoutFrameRef.current = window.requestAnimationFrame(() => {
        layoutFrameRef.current = null;
        if (!isAtBottomRef.current) {
          return;
        }

        scrollToBottom(isScrollingToBottomRef.current ? "smooth" : "auto");
        captureScrollMemory();
      });
    });

    resizeObserver.observe(list);
    resizeObserver.observe(content);
    return () => {
      resizeObserver.disconnect();
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
    };
  }, [scrollMemoryRef]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(refreshVisibleChatNotices);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [renderedMessages, pendingMentionMessages]);

  useLayoutEffect(() => {
    const latestMessage = renderedMessages[renderedMessages.length - 1] ?? null;
    const knownMessageIds = knownMessageIdsRef.current;
    const newlyRenderedMessages = renderedMessages.filter((message) => !knownMessageIds.has(message.id));
    knownMessageIdsRef.current = new Set(renderedMessages.map((message) => message.id));
    const previousOldestMessageId = oldestMessageIdRef.current;
    oldestMessageIdRef.current = renderedMessages[0]?.id ?? null;

    const olderHistoryAnchor = olderHistoryAnchorRef.current;
    const insertedOlderHistory = previousOldestMessageId !== null
      && newlyRenderedMessages.some((message) => message.id < previousOldestMessageId);
    if (olderHistoryAnchor && insertedOlderHistory) {
      const list = listRef.current;
      const anchorElement = getMessageElement(olderHistoryAnchor.messageId);
      if (list && anchorElement) {
        const listBounds = list.getBoundingClientRect();
        const nextOffset = anchorElement.getBoundingClientRect().top - listBounds.top;
        list.scrollTop += nextOffset - olderHistoryAnchor.offset;
      }
      olderHistoryAnchorRef.current = null;
    }

    if (coldStartScrollRef.current && !startupBaselineInitializedRef.current && latestMessage) {
      startupBaselineInitializedRef.current = true;
      startupLatestMessageIdRef.current = latestMessage.id;
      hasRestoredScrollRef.current = true;
      lastMessageIdRef.current = latestMessage.id;
      setHiddenUnreadState(null, 0);
      setLiveNewMessageState(null, 0);
      scrollToBottom("auto");
      captureScrollMemory();
      if (panelVisibleRef.current) {
        startupBottomPendingRef.current = false;
        scheduleScrollToBottomAfterLayout();
      }
      return;
    }

    if (!hasRestoredScrollRef.current) {
      hasRestoredScrollRef.current = true;
      const memory = scrollMemoryRef.current;
      lastMessageIdRef.current = latestMessage?.id ?? null;

      if (!memory) {
        setHiddenUnreadState(null, 0);
        setLiveNewMessageState(null, 0);
        scrollToBottom("auto");
        captureScrollMemory();
        return;
      }

      let firstUnreadMessageId = memory.firstUnreadMessageId;
      if (firstUnreadMessageId !== null && !renderedMessages.some((message) => message.id === firstUnreadMessageId)) {
        firstUnreadMessageId = null;
      }

      const previousLastIndex = memory.lastMessageId === null
        ? -1
        : renderedMessages.findIndex((message) => message.id === memory.lastMessageId);
      const messagesSinceLeaving = memory.lastMessageId === null
        ? []
        : previousLastIndex >= 0
          ? renderedMessages.slice(previousLastIndex + 1)
          : renderedMessages;
      const firstNewUnread = messagesSinceLeaving.find((message) => message.user.id !== currentUserId) ?? null;
      if (firstUnreadMessageId === null && firstNewUnread) {
        firstUnreadMessageId = firstNewUnread.id;
      }

      if (firstUnreadMessageId === null && memory.atBottom) {
        setHiddenUnreadState(null, 0);
        setLiveNewMessageState(null, 0);
        scrollToBottom("auto");
        captureScrollMemory();
        return;
      }

      const firstUnreadIndex = firstUnreadMessageId === null
        ? -1
        : renderedMessages.findIndex((message) => message.id === firstUnreadMessageId);
      const unreadCount = firstUnreadIndex >= 0
        ? renderedMessages
            .slice(firstUnreadIndex)
            .filter((message) => message.user.id !== currentUserId).length
        : firstUnreadMessageId === null
          ? 0
          : memory.unreadCount;

      isAtBottomRef.current = false;
      setHiddenUnreadState(unreadCount > 0 ? firstUnreadMessageId : null, unreadCount);
      restoreScrollPosition(memory);
      captureScrollMemory();

      restoreFrameRef.current = window.requestAnimationFrame(() => {
        const restoredMemory = scrollMemoryRef.current;
        if (restoredMemory && !isAtBottomRef.current) {
          restoreScrollPosition(restoredMemory);
          updateBottomState();
        }
      });
      return;
    }

    const previousLastId = lastMessageIdRef.current;
    if (!latestMessage) {
      lastMessageIdRef.current = null;
      setHiddenUnreadState(null, 0);
      setLiveNewMessageState(null, 0);
      captureScrollMemory();
      return;
    }

    if (latestMessage.id === previousLastId && newlyRenderedMessages.length === 0) {
      return;
    }

    const addedMessages = previousOldestMessageId === null
      ? newlyRenderedMessages
      : newlyRenderedMessages.filter((message) => message.id >= previousOldestMessageId);
    lastMessageIdRef.current = latestMessage.id;

    if (addedMessages.length === 0) {
      captureScrollMemory();
      return;
    }

    const insertedBeforePreviousTail = previousLastId !== null
      && addedMessages.some((message) => message.id <= previousLastId);
    if (insertedBeforePreviousTail && scrollMemoryRef.current) {
      restoreScrollPosition(scrollMemoryRef.current);
    }

    const externalAddedMessages = addedMessages.filter((message) => message.user.id !== currentUserId);
    if (!panelVisibleRef.current && externalAddedMessages.length > 0) {
      const firstUnreadMessageId = firstUnreadMessageIdRef.current === null
        ? externalAddedMessages[0].id
        : Math.min(firstUnreadMessageIdRef.current, externalAddedMessages[0].id);
      const unreadCount = unreadCountRef.current + externalAddedMessages.length;
      isAtBottomRef.current = false;
      setHiddenUnreadState(firstUnreadMessageId, unreadCount);
      captureScrollMemory();
      return;
    }

    const latestIsMine = latestMessage.user.id === currentUserId;
    if (isAtBottomRef.current || latestIsMine) {
      scrollToBottom("smooth");
      captureScrollMemory();
      return;
    }

    if (externalAddedMessages.length === 0) {
      captureScrollMemory();
      return;
    }

    const firstLiveMessageId = firstLiveNewMessageIdRef.current === null
      ? externalAddedMessages[0].id
      : Math.min(firstLiveNewMessageIdRef.current, externalAddedMessages[0].id);
    const liveMessageCount = liveNewMessageCountRef.current + externalAddedMessages.length;
    setLiveNewMessageState(firstLiveMessageId, liveMessageCount);
    captureScrollMemory();
  }, [renderedMessages, currentUserId, scrollMemoryRef]);

  useEffect(() => {
    const lastReadMessageId = startupLastReadMessageIdRef.current;
    const latestMessageIdAtStartup = startupLatestMessageIdRef.current;
    if (
      lastReadMessageId === null
      || latestMessageIdAtStartup === null
      || latestMessageIdAtStartup <= lastReadMessageId
      || renderedMessages.length === 0
    ) {
      firstStartupUnreadMessageIdRef.current = null;
      setStartupUnreadCount(0);
      return;
    }

    const startupUnreadMessages = renderedMessages.filter(
      (message) => message.id > lastReadMessageId
        && message.id <= latestMessageIdAtStartup
        && message.user.id !== currentUserId
    );
    firstStartupUnreadMessageIdRef.current = startupUnreadMessages[0]?.id ?? null;
    setStartupUnreadCount(startupUnreadMessages.length);
    if (startupUnreadMessages.length > 0 && !panelVisibleRef.current) {
      window.xiaoelongDesktop?.setTrayUnread?.(true);
    }

    const oldestMessageId = renderedMessages[0]?.id ?? null;
    const boundaryNeedsOlderMessages = oldestMessageId !== null
      && oldestMessageId > lastReadMessageId
      && hasOlderMessages;
    if (boundaryNeedsOlderMessages && !loadingOlderMessages && !olderMessagesError) {
      void loadOlderMessages();
    }
  }, [
    renderedMessages,
    currentUserId,
    hasOlderMessages,
    loadingOlderMessages,
    olderMessagesError,
    loadOlderMessages
  ]);

  useEffect(() => {
    if (!loadingOlderMessages) {
      olderHistoryAnchorRef.current = null;
    }
  }, [loadingOlderMessages, hasOlderMessages, olderMessagesError]);

  useLayoutEffect(() => {
    return () => {
      if (restoreFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFrameRef.current);
      }
      if (startupFrameRef.current !== null) {
        window.cancelAnimationFrame(startupFrameRef.current);
      }
      captureScrollMemory();
    };
  }, [scrollMemoryRef]);

  useEffect(() => {
    if (viewerIndex !== null && viewerIndex >= imageMessages.length) {
      setViewerIndex(imageMessages.length > 0 ? imageMessages.length - 1 : null);
    }
  }, [viewerIndex, imageMessages.length]);

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setViewerIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        showPreviousImage();
        return;
      }
      if (event.key === "ArrowRight") {
        showNextImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewerIndex, imageMessages.length]);

  useEffect(() => {
    function resetDragDepth(): void {
      setDragDepth(0);
    }

    window.addEventListener("drop", resetDragDepth);
    window.addEventListener("dragend", resetDragDepth);
    window.addEventListener("blur", resetDragDepth);
    return () => {
      window.removeEventListener("drop", resetDragDepth);
      window.removeEventListener("dragend", resetDragDepth);
      window.removeEventListener("blur", resetDragDepth);
    };
  }, []);

  function clearSelectedAttachment(): void {
    setImageFile(null);
    setFileFile(null);
    setAttachmentError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function selectAttachment(file: File): void {
    const validationError = validateAttachmentFile(file);
    if (validationError) {
      clearSelectedAttachment();
      setAttachmentError(validationError);
      return;
    }

    setAttachmentError(null);
    if (isAllowedImageFile(file)) {
      setImageFile(file);
      setFileFile(null);
      return;
    }

    setImageFile(null);
    setFileFile(file);
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>): void {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      clearSelectedAttachment();
      return;
    }

    selectAttachment(selectedFile);
  }

  async function sendMessage(
    nextContent: string,
    nextImageFile: File | null,
    nextFileFile: File | null,
    nextReplyToMessageId: number | null,
    nextMentionAll: boolean,
    nextMentionedUserIds: string[]
  ): Promise<void> {
    const hasMentionRecipients = nextMentionAll || nextMentionedUserIds.length > 0;
    if (sending || (!nextContent.trim() && !nextImageFile && !nextFileFile && !hasMentionRecipients)) {
      return;
    }

    setSending(true);
    try {
      await onSendMessage({
        content: nextContent,
        imageFile: nextImageFile,
        fileFile: nextFileFile,
        replyToMessageId: nextReplyToMessageId,
        mentionAll: nextMentionAll,
        mentionedUserIds: nextMentionedUserIds
      });
      setContent("");
      setReplyToMessageId((current) => current === nextReplyToMessageId ? null : current);
      setMentionAll(false);
      setMentionedUserIds([]);
      setMentionPickerOpen(false);
      clearSelectedAttachment();
    } catch {
      // Keep input content for retry when send fails.
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await sendMessage(content, imageFile, fileFile, replyToMessageId, mentionAll, mentionedUserIds);
  }

  async function handlePaste(event: ClipboardEvent<HTMLInputElement>): Promise<void> {
    const pastedImage = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .find((file): file is File => Boolean(file));

    if (!pastedImage) {
      return;
    }

    event.preventDefault();
    const normalizedImage = normalizeClipboardImageFile(pastedImage);
    const validationError = validateImageFile(normalizedImage);
    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    setAttachmentError(null);
    await sendMessage(content, normalizedImage, null, replyToMessageId, mentionAll, mentionedUserIds);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>): void {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragDepth((count) => count + 1);
  }

  function handleDragOver(event: DragEvent<HTMLElement>): void {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>): void {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragDepth((count) => Math.max(0, count - 1));
  }

  function handleDrop(event: DragEvent<HTMLElement>): void {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragDepth(0);
    const selectedFile = Array.from(event.dataTransfer.files).find(Boolean) ?? null;
    if (selectedFile) {
      selectAttachment(selectedFile);
    }
  }

  const hasPendingAttachment = Boolean(imageFile || fileFile);
  const startupLastReadMessageId = startupLastReadMessageIdRef.current;
  const oldestRenderedMessageId = renderedMessages[0]?.id ?? null;
  const locatingFirstStartupUnread = startupUnreadCount > 0
    && startupLastReadMessageId !== null
    && oldestRenderedMessageId !== null
    && oldestRenderedMessageId > startupLastReadMessageId
    && hasOlderMessages;

  return (
    <section
      className={`chat-panel ${dragDepth > 0 ? "dragging-file" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="module-head">
        <h2>群聊</h2>
        <div className="chat-head-actions">
          {pendingMentionMessages.length > 0 ? (
            <button
              type="button"
              className="chat-mention-alert"
              aria-label={`有人@你，共 ${pendingMentionMessages.length} 条`}
              title="跳到下一条@你的消息"
              onClick={scrollToNextMention}
            >
              有人@你
              {pendingMentionMessages.length > 1 ? <small>{pendingMentionMessages.length}</small> : null}
            </button>
          ) : null}
          {startupUnreadCount > 0 ? (
            <button
              type="button"
              className="chat-unread-jump"
              aria-label={locatingFirstStartupUnread
                ? `正在定位本次启动后的第一条新消息，已找到 ${startupUnreadCount} 条`
                : `返回本次启动后的第一条新消息，共 ${startupUnreadCount} 条`}
              title={locatingFirstStartupUnread
                ? `正在定位第一条新消息（已找到 ${startupUnreadCount} 条）`
                : `返回本次启动后的第一条新消息（${startupUnreadCount} 条）`}
              onClick={scrollToFirstStartupUnread}
            >
              <span aria-hidden="true">{unreadJumpDirection === "up" ? "↑" : "↓"}</span>
              <small>{startupUnreadCount > 99 ? "99+" : startupUnreadCount}</small>
            </button>
          ) : hiddenUnreadCount > 0 ? (
            <button
              type="button"
              className="chat-unread-jump"
              aria-label={`返回关闭期间第一条未读消息，共 ${hiddenUnreadCount} 条`}
              title={`返回关闭期间第一条未读消息（${hiddenUnreadCount} 条）`}
              onClick={scrollToFirstHiddenUnread}
            >
              <span aria-hidden="true">{unreadJumpDirection === "up" ? "↑" : "↓"}</span>
              <small>{hiddenUnreadCount > 99 ? "99+" : hiddenUnreadCount}</small>
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="chat-list"
        ref={listRef}
        onScroll={updateBottomState}
        onWheel={cancelPendingScrollToBottom}
        onTouchStart={cancelPendingScrollToBottom}
        onPointerDown={cancelPendingScrollToBottom}
      >
        <div className="chat-list-content" ref={listContentRef}>
          <div className="chat-history-status" role="status" aria-live="polite">
            {loadingOlderMessages
              ? "正在加载更早的消息…"
              : olderMessagesError
                ? (
                    <button type="button" onClick={() => void loadOlderMessages()}>
                      加载失败，点击重试
                    </button>
                  )
                : !hasOlderMessages && renderedMessages.length > 0
                  ? "已经到最早的消息了"
                  : ""}
          </div>
          {renderedMessages.map((message) => {
            const isMine = message.user.id === currentUserId;
            const replyTo = message.replyTo;
            const isReplyTargetVisible = replyTo ? renderedMessageIds.has(replyTo.id) : false;
            const messageMentionUsers = (message.mentionedUserIds ?? []).map((mentionedUserId) => ({
              id: mentionedUserId,
              nickname: presenceUsers.find((user) => user.id === mentionedUserId)?.nickname ?? "已注销成员"
            }));
            return (
              <article
                className={`chat-item ${isMine ? "mine" : ""} ${replyToMessageId === message.id ? "reply-selected" : ""} ${highlightedMessageId === message.id ? "quoted-target" : ""}`}
                key={message.id}
                data-message-id={message.id}
                title="右键引用此消息"
                onContextMenu={(event) => {
                  event.preventDefault();
                  beginReply(message.id);
                }}
              >
                <UserAvatar user={message.user} />
                <div className="bubble">
                  <header>
                    <strong>{message.user.nickname}</strong>
                    <time dateTime={message.createdAt}>{formatChatTimestamp(message.createdAt)}</time>
                  </header>
                  {replyTo ? (
                    <button
                      type="button"
                      className="chat-message-quote"
                      disabled={!isReplyTargetVisible}
                      title={isReplyTargetVisible ? "跳到原消息" : "原消息不在当前聊天记录中"}
                      onClick={() => scrollToQuotedMessage(replyTo.id)}
                    >
                      <strong>{replyTo.user.nickname}</strong>
                      <span>{getMessagePreview(replyTo)}</span>
                    </button>
                  ) : null}
                  {message.mentionAll || messageMentionUsers.length > 0 ? (
                    <div className="chat-message-mentions" aria-label="消息提及">
                      {message.mentionAll ? <span>@所有人</span> : null}
                      {messageMentionUsers.map((user) => <span key={user.id}>@{user.nickname}</span>)}
                    </div>
                  ) : null}
                  {message.image ? (
                    <button
                      type="button"
                      className="chat-image-button"
                      onClick={() => openImageViewer(message.id)}
                    >
                      <img
                        className="chat-image"
                        src={withServerUrl(message.image.url) ?? message.image.url}
                        alt={message.image.name}
                        onLoad={handleRenderedImageLoad}
                      />
                    </button>
                  ) : null}
                  {message.file ? (
                    <button
                      type="button"
                      className="chat-file-card"
                      onClick={() => {
                        void downloadChatFile(message.file as ChatFile);
                      }}
                    >
                      <span className="chat-file-icon">FILE</span>
                      <span className="chat-file-info">
                        <strong>{message.file.name}</strong>
                        <span>{formatFileSize(message.file.size)}</span>
                      </span>
                      <span className="chat-file-action">下载</span>
                    </button>
                  ) : null}
                  {message.content ? <p>{message.content}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {dragDepth > 0 ? <div className="chat-drop-overlay">释放以添加附件</div> : null}

      <div className="chat-compose">
        {liveNewMessageCount > 0 ? (
          <button type="button" className="chat-new-message-pill" onClick={scrollToFirstLiveNewMessage}>
            <span aria-hidden="true">↓</span> 有新消息 {liveNewMessageCount} 条
          </button>
        ) : null}

        {mentionAll || mentionedUsers.length > 0 ? (
          <div className="chat-mention-selection" aria-label="已选择的提及对象">
            {mentionAll ? (
              <button type="button" disabled={sending} onClick={() => setMentionAll(false)}>
                @所有人 <span aria-hidden="true">×</span>
              </button>
            ) : null}
            {mentionedUsers.map((user) => (
              <button key={user.id} type="button" disabled={sending} onClick={() => toggleMentionUser(user.id)}>
                @{user.nickname} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}

        {mentionPickerOpen ? (
          <div className="chat-mention-picker" role="group" aria-label="选择要提及的成员">
            <button
              type="button"
              className={mentionAll ? "selected" : ""}
              aria-pressed={mentionAll}
              onClick={toggleMentionAll}
            >
              <strong>@所有人</strong>
            </button>
            {mentionableUsers.map((user) => {
              const selected = mentionedUserIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => toggleMentionUser(user.id)}
                >
                  <strong>@{user.nickname}</strong>
                  <small>{user.isOnline ? "在线" : "离线"}</small>
                </button>
              );
            })}
          </div>
        ) : null}

        {replyToMessage ? (
          <div className="chat-reply-preview">
            <span className="chat-reply-preview-content">
              <strong>引用 {replyToMessage.user.nickname}</strong>
              <small>{getMessagePreview(replyToMessage)}</small>
            </span>
            <button
              type="button"
              className="chat-reply-cancel"
              aria-label="取消引用"
              title="取消引用"
              disabled={sending}
              onClick={() => setReplyToMessageId(null)}
            >
              ×
            </button>
          </div>
        ) : null}

        {imagePreviewUrl || fileFile ? (
          <div className={`chat-attachment-preview ${fileFile ? "file" : "image"}`}>
            {imagePreviewUrl ? <img src={imagePreviewUrl} alt={imageFile?.name ?? ""} /> : null}
            {fileFile ? <span className="chat-file-icon">FILE</span> : null}
            <span className="chat-attachment-name">
              {imageFile?.name ?? fileFile?.name}
              {fileFile ? <small>{formatFileSize(fileFile.size)}</small> : null}
            </span>
            <button type="button" className="ghost-button" disabled={sending} onClick={clearSelectedAttachment}>
              移除
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="chat-form">
          <input
            ref={composeInputRef}
            type="text"
            placeholder="写点什么..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={(event) => {
              void handlePaste(event);
            }}
            maxLength={1000}
          />
          <button
            type="button"
            className="chat-mention-button"
            aria-label="选择要@的成员"
            aria-expanded={mentionPickerOpen}
            disabled={sending}
            onClick={() => setMentionPickerOpen((open) => !open)}
          >
            @
          </button>
          <input
            ref={fileInputRef}
            className="chat-attachment-input"
            type="file"
            onChange={handleAttachmentChange}
          />
          <button
            type="button"
            className="chat-attach-button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
          >
            附件
          </button>
          <button
            type="submit"
            disabled={sending || (!content.trim() && !hasPendingAttachment && !mentionAll && mentionedUserIds.length === 0)}
          >
            {sending ? "发送中" : "发送"}
          </button>
        </form>
        {attachmentError ? <p className="error-text">{attachmentError}</p> : null}
        {sendError ? <p className="error-text">{sendError}</p> : null}
      </div>

      {activeImage ? (
        <div
          className="chat-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setViewerIndex(null)}
        >
          <div className="chat-image-viewer-inner" onClick={(event) => event.stopPropagation()}>
            <div className="chat-image-viewer-top">
              <span>{activeImage.userNickname}</span>
              <button type="button" className="chat-image-viewer-close" onClick={() => setViewerIndex(null)}>
                ×
              </button>
            </div>
            <div className="chat-image-viewer-stage">
              {imageMessages.length > 1 ? (
                <button type="button" className="chat-image-nav previous" onClick={showPreviousImage}>
                  ‹
                </button>
              ) : null}
              <img src={activeImage.url} alt={activeImage.image.name} />
              {imageMessages.length > 1 ? (
                <button type="button" className="chat-image-nav next" onClick={showNextImage}>
                  ›
                </button>
              ) : null}
            </div>
            <div className="chat-image-viewer-name">{activeImage.image.name}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
});
