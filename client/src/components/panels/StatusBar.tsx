import { KeyboardEvent, memo, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MoodEmoji } from "@xiaoelong/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useDaily } from "../../contexts/DailyContext";
import { useDesktop } from "../../contexts/DesktopContext";
import { UserAvatar } from "../atoms/UserAvatar";

export const StatusBar = memo(function StatusBar(): JSX.Element {
  const { currentUserId } = useAuth();
  const { presenceUsers: users } = useChat();
  const { moodOptions, moodLoading, selectMood } = useDaily();
  const { desktopRole } = useDesktop();
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const lastExtraHeightRef = useRef(-1);

  // 汇报成员列表额外高度给 Electron 壳层（仅 panel 角色需要）
  const handleExtraHeight = useCallback(
    (height: number): void => {
      if (desktopRole === "panel") {
        window.xiaoelongDesktop?.setPanelContentExtraHeight?.(height);
      }
    },
    [desktopRole]
  );

  useLayoutEffect(() => {
    const listElement = listRef.current;
    const onExtraHeightChange = handleExtraHeight;
    if (!listElement || !onExtraHeightChange) {
      return;
    }
    const observedList: HTMLDivElement = listElement;
    const reportHeight: (height: number) => void = onExtraHeightChange;

    function reportExtraHeight(): void {
      const children = Array.from(observedList.children) as HTMLElement[];
      const singleRowHeight = children.reduce(
        (maxHeight, child) => Math.max(maxHeight, child.getBoundingClientRect().height),
        0
      );
      const extraHeight = singleRowHeight > 0
        ? Math.max(0, Math.ceil(observedList.getBoundingClientRect().height - singleRowHeight))
        : 0;
      if (lastExtraHeightRef.current === extraHeight) {
        return;
      }

      lastExtraHeightRef.current = extraHeight;
      reportHeight(extraHeight);
    }

    const observer = new ResizeObserver(reportExtraHeight);
    observer.observe(observedList);
    reportExtraHeight();
    return () => observer.disconnect();
  }, [handleExtraHeight]);

  useLayoutEffect(() => {
    const pickerElement = pickerRef.current;
    const rootElement = rootRef.current;
    if (!pickerOpen || !pickerElement || !rootElement) {
      return;
    }
    const observedPicker: HTMLDivElement = pickerElement;
    const observedRoot: HTMLElement = rootElement;

    function keepPickerInsideStatusBar(): void {
      observedPicker.style.setProperty("--status-mood-picker-shift-x", "0px");

      const pickerRect = observedPicker.getBoundingClientRect();
      const rootRect = observedRoot.getBoundingClientRect();
      const minimumLeft = Math.max(8, rootRect.left);
      const maximumRight = Math.min(window.innerWidth - 8, rootRect.right);
      let shiftX = 0;

      if (pickerRect.left < minimumLeft) {
        shiftX = minimumLeft - pickerRect.left;
      }
      if (pickerRect.right + shiftX > maximumRight) {
        shiftX += maximumRight - (pickerRect.right + shiftX);
      }

      observedPicker.style.setProperty("--status-mood-picker-shift-x", `${shiftX}px`);
    }

    keepPickerInsideStatusBar();
    const resizeObserver = new ResizeObserver(keepPickerInsideStatusBar);
    resizeObserver.observe(observedRoot);
    window.addEventListener("resize", keepPickerInsideStatusBar);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", keepPickerInsideStatusBar);
    };
  }, [pickerOpen, users]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function handleDocumentPointerDown(event: globalThis.PointerEvent): void {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setPickerOpen(false);
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [pickerOpen]);

  function handleStatusKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setPickerOpen((prev) => !prev);
  }

  function handleMoodClick(event: MouseEvent<HTMLButtonElement>, emoji: MoodEmoji): void {
    event.stopPropagation();
    void selectMood(emoji);
    setPickerOpen(false);
  }

  return (
    <section
      className={`status-bar${pickerOpen ? " picker-open" : ""}`}
      aria-label="成员状态"
      ref={rootRef}
    >
      <div className="status-list" ref={listRef}>
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          return (
            <div
              className={`status-item ${user.isOnline ? "online" : "offline"} ${isCurrentUser ? "editable" : ""}`}
              key={user.id}
              onClick={isCurrentUser ? () => setPickerOpen((prev) => !prev) : undefined}
              onKeyDown={isCurrentUser ? handleStatusKeyDown : undefined}
              role={isCurrentUser ? "button" : undefined}
              tabIndex={isCurrentUser ? 0 : undefined}
              title={isCurrentUser ? undefined : user.nickname}
            >
              <div className="avatar-wrap">
                <UserAvatar user={user} />
                <span className={`presence-dot ${user.isOnline ? "online" : "offline"}`} />
              </div>
              <span className="status-name">{user.nickname}</span>
              {user.todayMood ? (
                <span className="status-mood-badge">
                  <span className="mood-emoji">{user.todayMood.emoji}</span>
                </span>
              ) : null}
              {isCurrentUser ? <span className="status-self">我</span> : null}
              {isCurrentUser && pickerOpen ? (
                <div
                  className="status-mood-picker"
                  ref={pickerRef}
                  onClick={(event) => event.stopPropagation()}
                >
                  {moodOptions.map((emoji) => (
                    <button
                      type="button"
                      className={user.todayMood?.emoji === emoji ? "selected" : ""}
                      disabled={moodLoading}
                      key={emoji}
                      onClick={(event) => handleMoodClick(event, emoji)}
                    >
                      <span className="mood-emoji">{emoji}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
});
