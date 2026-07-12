import { KeyboardEvent, memo, MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MoodEmoji, PresenceUser } from "@xiaoelong/shared";
import { UserAvatar } from "./UserAvatar";

interface StatusBarProps {
  currentUserId: string;
  users: PresenceUser[];
  moodOptions: MoodEmoji[];
  moodLoading: boolean;
  onSelectMood: (emoji: MoodEmoji) => void | Promise<void>;
  onExtraHeightChange?: (height: number) => void;
}

export const StatusBar = memo(function StatusBar(props: StatusBarProps): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastExtraHeightRef = useRef(-1);

  useLayoutEffect(() => {
    const listElement = listRef.current;
    const onExtraHeightChange = props.onExtraHeightChange;
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
  }, [props.onExtraHeightChange]);

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
    void props.onSelectMood(emoji);
    setPickerOpen(false);
  }

  return (
    <section className="status-bar" aria-label="成员状态" ref={rootRef}>
      <div className="status-list" ref={listRef}>
        {props.users.map((user) => {
          const isCurrentUser = user.id === props.currentUserId;
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
                <div className="status-mood-picker" onClick={(event) => event.stopPropagation()}>
                  {props.moodOptions.map((emoji) => (
                    <button
                      type="button"
                      className={user.todayMood?.emoji === emoji ? "selected" : ""}
                      disabled={props.moodLoading}
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
