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
import { withServerUrl } from "../env";
import { UserAvatar } from "./UserAvatar";

interface ChatPanelProps {
  currentUserId: string;
  messages: ChatMessage[];
  sendError: string | null;
  onSendMessage: (payload: { content: string; imageFile: File | null; fileFile: File | null }) => Promise<void>;
}

const ALLOWED_CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const BLOCKED_CHAT_FILE_EXTENSIONS = [".exe", ".bat", ".cmd", ".msi", ".ps1", ".js", ".vbs", ".scr", ".com"];

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

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export const ChatPanel = memo(function ChatPanel(props: ChatPanelProps): JSX.Element {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileFile, setFileFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef<number | null>(null);

  const renderedMessages = useMemo(() => props.messages, [props.messages]);
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

  function scrollToBottom(behavior: ScrollBehavior = "auto"): void {
    const list = listRef.current;
    if (!list) {
      return;
    }
    list.scrollTo({
      top: list.scrollHeight,
      behavior
    });
    isAtBottomRef.current = true;
    setNewMessageCount(0);
  }

  function updateBottomState(): void {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isAtBottom = distanceToBottom <= 28;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setNewMessageCount(0);
    }
  }

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

  function handleRenderedImageLoad(message: ChatMessage): void {
    const latestMessage = renderedMessages[renderedMessages.length - 1] ?? null;
    const shouldKeepAtBottom = isAtBottomRef.current || message.user.id === props.currentUserId;
    if (latestMessage?.id === message.id && shouldKeepAtBottom) {
      window.requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }

  useLayoutEffect(() => {
    const latestMessage = renderedMessages[renderedMessages.length - 1] ?? null;
    const previousLastId = lastMessageIdRef.current;
    if (!latestMessage) {
      lastMessageIdRef.current = null;
      setNewMessageCount(0);
      return;
    }

    const isInitialLoad = previousLastId === null;
    const hasNewMessage = latestMessage.id !== previousLastId;
    lastMessageIdRef.current = latestMessage.id;

    if (!hasNewMessage) {
      return;
    }

    const latestIsMine = latestMessage.user.id === props.currentUserId;
    if (isInitialLoad || isAtBottomRef.current || latestIsMine) {
      scrollToBottom(isInitialLoad ? "auto" : "smooth");
      return;
    }

    setNewMessageCount((count) => count + 1);
  }, [renderedMessages, props.currentUserId]);

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

  async function sendMessage(nextContent: string, nextImageFile: File | null, nextFileFile: File | null): Promise<void> {
    if (sending || (!nextContent.trim() && !nextImageFile && !nextFileFile)) {
      return;
    }

    setSending(true);
    try {
      await props.onSendMessage({
        content: nextContent,
        imageFile: nextImageFile,
        fileFile: nextFileFile
      });
      setContent("");
      clearSelectedAttachment();
    } catch {
      // Keep input content for retry when send fails.
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await sendMessage(content, imageFile, fileFile);
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
    await sendMessage(content, normalizedImage, null);
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
      </div>
      <div className="chat-list" ref={listRef} onScroll={updateBottomState}>
        {renderedMessages.map((message) => {
          const isMine = message.user.id === props.currentUserId;
          return (
            <article className={`chat-item ${isMine ? "mine" : ""}`} key={message.id}>
              <UserAvatar user={message.user} />
              <div className="bubble">
                <header>
                  <strong>{message.user.nickname}</strong>
                  <time>{formatTime(message.createdAt)}</time>
                </header>
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
                      onLoad={() => handleRenderedImageLoad(message)}
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

      {dragDepth > 0 ? <div className="chat-drop-overlay">释放以添加附件</div> : null}

      <div className="chat-compose">
        {newMessageCount > 0 ? (
          <button type="button" className="chat-new-message-pill" onClick={() => scrollToBottom("smooth")}>
            有新消息 {newMessageCount} 条
          </button>
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
            type="text"
            placeholder="写点什么..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={(event) => {
              void handlePaste(event);
            }}
            maxLength={1000}
          />
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
          <button type="submit" disabled={sending || (!content.trim() && !hasPendingAttachment)}>
            {sending ? "发送中" : "发送"}
          </button>
        </form>
        {attachmentError ? <p className="error-text">{attachmentError}</p> : null}
        {props.sendError ? <p className="error-text">{props.sendError}</p> : null}
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
