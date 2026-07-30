const CHAT_TIME_ZONE = "Asia/Shanghai";

const chatTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: CHAT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const chatDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: CHAT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function getDateKey(date: Date): string {
  const parts = chatDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function formatChatTimestamp(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const time = chatTimeFormatter.format(date);
  if (!Number.isNaN(now.getTime()) && getDateKey(date) === getDateKey(now)) {
    return time;
  }

  return `${getDateKey(date)} ${time}`;
}
