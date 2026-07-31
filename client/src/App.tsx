import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MOOD_OPTIONS,
  type ChatFile,
  type ChatImage,
  type ChatMessage,
  type DailyMood,
  type DailyMoodUpdatePayload,
  type DailyMoodTodayResponse,
  type DailyQuestionTodayResponse,
  type DeityId,
  type DeityWorshipResponse,
  type DeityWorshipTodayResponse,
  type GomokuEndPayload,
  type GomokuGame,
  type GomokuUpdatePayload,
  type MoodEmoji,
  type PresenceDeltaPayload,
  type PresenceUser,
  type UserProfile
} from "@xiaoelong/shared";
import {
  ApiError,
  deleteCurrentUser,
  getGomokuGames,
  getMe,
  getRecentMessages,
  getTodayDeityWorship,
  getTodayQuestion,
  getTodayMood,
  joinWithInvite,
  setTodayMood,
  submitDeityWorship,
  submitTodayAnswer,
  updateCurrentProfile,
  uploadChatFile,
  uploadChatImage
} from "./api";
import { AvatarDock } from "./components/AvatarDock";
import { ChatPanel, type ChatScrollMemory } from "./components/ChatPanel";
import { DailyQuestionPanel } from "./components/DailyQuestionPanel";
import { DivineSelectionPanel, FullScreenDivineSelection } from "./components/DivineSelectionPanel";
import { GomokuPanel } from "./components/GomokuPanel";
import { JoinForm } from "./components/JoinForm";
import { SettingsProfileForm } from "./components/SettingsProfileForm";
import { StatusBar } from "./components/StatusBar";
import {
  getNextPetDisplayMode,
  getPetReaction,
  normalizePetDisplayMode,
  type PetDisplayMode,
  type PetReaction
} from "./pet-animation";
import { connectSocket, type AppSocket } from "./socket";
import clientPackage from "../package.json";

const TOKEN_STORAGE_KEY = "xiaoelong_access_token";
const PET_ANIMATIONS_STORAGE_KEY = "xiaoelong_pet_animations_enabled";
const PET_DISPLAY_MODE_STORAGE_KEY = "xiaoelong_pet_display_mode";
const PET_DISPLAY_MODE_LABELS: Record<PetDisplayMode, string> = {
  dynamic: "动态显示：开",
  static: "动态显示：关",
  image: "只显示形象"
};
const DEFAULT_MOOD_OPTIONS: MoodEmoji[] = [...MOOD_OPTIONS];

function getInitialAccessToken(): string | null {
  const browserToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (browserToken) {
    return browserToken;
  }

  const persistedToken = window.xiaoelongDesktop?.getPersistedAccessToken?.() ?? null;
  if (persistedToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, persistedToken);
  }
  return persistedToken;
}

function getInitialPetDisplayMode(): PetDisplayMode {
  const legacyValue = localStorage.getItem(PET_ANIMATIONS_STORAGE_KEY);
  return normalizePetDisplayMode(
    localStorage.getItem(PET_DISPLAY_MODE_STORAGE_KEY),
    legacyValue === null ? undefined : legacyValue !== "false"
  );
}

interface InitialDivineSession {
  requestId: number;
  data: DeityWorshipTodayResponse | null;
}

function getInitialDivineSession(): InitialDivineSession {
  if (window.xiaoelongDesktop?.role !== "divine") {
    return { requestId: 0, data: null };
  }
  return window.xiaoelongDesktop.getInitialDivineSession?.() ?? {
    requestId: 0,
    data: window.xiaoelongDesktop.getInitialDivineData?.() ?? null
  };
}

const INITIAL_DIVINE_SESSION = getInitialDivineSession();

type ModuleTab = "chat" | "daily" | "divine" | "gomoku";
type DesktopRole = "auth" | "avatar" | "panel" | "divine" | "single";
type PanelView = "home" | "settings";

interface InitialPanelSession {
  requestId: number;
  view: PanelView;
}

interface DesktopSettingsState {
  openAtLogin: boolean;
  panelAlwaysOnTop: boolean;
  petDisplayMode: PetDisplayMode;
  petAnimationsEnabled: boolean;
}

function getDesktopRole(): DesktopRole {
  if (!window.xiaoelongDesktop?.isDesktop) {
    return "single";
  }

  const role = window.xiaoelongDesktop.role ?? new URLSearchParams(window.location.search).get("desktopRole");
  return role === "auth" || role === "avatar" || role === "panel" || role === "divine" ? role : "auth";
}

function getInitialPanelSession(): InitialPanelSession {
  const view = new URLSearchParams(window.location.search).get("desktopPanelView");
  const fallback: InitialPanelSession = {
    requestId: 0,
    view: view === "settings" ? "settings" : "home"
  };
  if (window.xiaoelongDesktop?.role !== "panel") {
    return fallback;
  }
  return window.xiaoelongDesktop.getInitialPanelSession?.() ?? fallback;
}

function scheduleAfterNextPaint(callback: () => void): () => void {
  let secondFrame: number | null = null;
  const firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(callback);
  });

  return () => {
    window.cancelAnimationFrame(firstFrame);
    if (secondFrame !== null) {
      window.cancelAnimationFrame(secondFrame);
    }
  };
}

const INITIAL_PANEL_SESSION = getInitialPanelSession();
const INITIAL_PET_DISPLAY_MODE = getInitialPetDisplayMode();

function updatePresenceStatus(current: PresenceUser[], onlineUserIds: string[]): PresenceUser[] {
  const onlineSet = new Set(onlineUserIds);
  return current.map((user) => ({
    ...user,
    isOnline: onlineSet.has(user.id)
  }));
}

function applyPresenceDelta(current: PresenceUser[], payload: PresenceDeltaPayload): PresenceUser[] {
  const onlineSet = new Set(payload.onlineUserIds);
  const exists = current.some((user) => user.id === payload.userId);

  let next = current;
  if (!exists && payload.user) {
    next = [...current, { ...payload.user, isOnline: onlineSet.has(payload.user.id) }];
  }

  return next.map((user) => ({
    ...user,
    isOnline: onlineSet.has(user.id)
  }));
}

function applyMoodUpdate(current: PresenceUser[], userId: string, mood: DailyMood): PresenceUser[] {
  return current.map((user) => (user.id === userId ? { ...user, todayMood: mood } : user));
}

function applyUserUpdateToPresence(current: PresenceUser[], user: UserProfile): PresenceUser[] {
  return current.map((item) => (item.id === user.id ? { ...item, ...user } : item));
}

function applyUserUpdateToMessages(current: ChatMessage[], user: UserProfile): ChatMessage[] {
  return current.map((message) => (message.user.id === user.id ? { ...message, user } : message));
}

function applyUserUpdateToGames(current: GomokuGame[], user: UserProfile): GomokuGame[] {
  let changed = false;
  const next = current.map((game) => {
    const updatesBlack = game.playerBlack.id === user.id;
    const updatesWhite = game.playerWhite.id === user.id;
    if (!updatesBlack && !updatesWhite) {
      return game;
    }

    changed = true;
    return {
      ...game,
      playerBlack: updatesBlack ? { ...game.playerBlack, ...user } : game.playerBlack,
      playerWhite: updatesWhite ? { ...game.playerWhite, ...user } : game.playerWhite
    };
  });
  return changed ? next : current;
}

function applyUserUpdateToDailyData(
  current: DailyQuestionTodayResponse | null,
  user: UserProfile
): DailyQuestionTodayResponse | null {
  if (!current) {
    return current;
  }

  return {
    ...current,
    stats: {
      ...current.stats,
      voters: current.stats.voters.map((group) =>
        group.map((voter) => (voter.id === user.id ? { ...voter, ...user } : voter))
      )
    }
  };
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401;
}

function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<number>();
  const deduped: ChatMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) {
      continue;
    }
    seen.add(message.id);
    deduped.push(message);
  }
  return deduped;
}

function areUserProfilesEqual(left: UserProfile, right: UserProfile): boolean {
  return (
    left.id === right.id &&
    left.nickname === right.nickname &&
    left.avatarUrl === right.avatarUrl &&
    left.createdAt === right.createdAt
  );
}

function areBoardsEqual(left: number[][], right: number[][]): boolean {
  return (
    left.length === right.length &&
    left.every((row, rowIndex) => {
      const rightRow = right[rowIndex];
      return Boolean(rightRow) && row.length === rightRow.length && row.every((cell, colIndex) => cell === rightRow[colIndex]);
    })
  );
}

function areGamesEqual(left: GomokuGame, right: GomokuGame): boolean {
  return (
    left.id === right.id &&
    left.status === right.status &&
    left.currentTurn === right.currentTurn &&
    left.winner === right.winner &&
    left.invitedBy === right.invitedBy &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    areUserProfilesEqual(left.playerBlack, right.playerBlack) &&
    areUserProfilesEqual(left.playerWhite, right.playerWhite) &&
    areBoardsEqual(left.boardState, right.boardState)
  );
}

function compareGames(left: GomokuGame, right: GomokuGame): number {
  return right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id;
}

function upsertGame(list: GomokuGame[], game: GomokuGame): GomokuGame[] {
  const existingIndex = list.findIndex((item) => item.id === game.id);
  if (existingIndex === -1) {
    return [game, ...list].sort(compareGames);
  }

  if (areGamesEqual(list[existingIndex], game)) {
    return list;
  }

  const next = [...list];
  next[existingIndex] = game;
  return next.sort(compareGames);
}

async function emitWithAck<T>(
  socket: AppSocket,
  event: "gomoku:invite" | "gomoku:accept" | "gomoku:reject" | "gomoku:move",
  payload: Record<string, unknown>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`${event} timeout.`));
      }
    }, 8000);

    socket.emit(event, payload as never, (ack) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);

      if (!ack.ok) {
        reject(new Error(ack.error || `${event} failed.`));
        return;
      }
      resolve(ack as unknown as T);
    });
  });
}

export default function App(): JSX.Element {
  const socketRef = useRef<AppSocket | null>(null);
  const appliedDivineSessionRequestIdRef = useRef(INITIAL_DIVINE_SESSION.requestId);
  const deityDataVersionRef = useRef(0);
  const pendingGomokuMoveIdsRef = useRef<Set<number>>(new Set());
  const chatScrollMemoryRef = useRef<ChatScrollMemory | null>(null);
  const [token, setToken] = useState<string | null>(getInitialAccessToken);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dailyData, setDailyData] = useState<DailyQuestionTodayResponse | null>(null);
  const [moodStatus, setMoodStatus] = useState<DailyMoodTodayResponse | null>(null);
  const [deityData, setDeityData] = useState<DeityWorshipTodayResponse | null>(INITIAL_DIVINE_SESSION.data);
  const [gomokuGames, setGomokuGames] = useState<GomokuGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);

  const [booting, setBooting] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);
  const [sessionRetryKey, setSessionRetryKey] = useState(0);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [moodLoading, setMoodLoading] = useState(false);
  const [deityError, setDeityError] = useState<string | null>(null);
  const [deityLoading, setDeityLoading] = useState(false);
  const [deitySubmittingId, setDeitySubmittingId] = useState<DeityId | null>(null);
  const [divineViewSession, setDivineViewSession] = useState(0);
  const [divineRevealRequestId, setDivineRevealRequestId] = useState(INITIAL_DIVINE_SESSION.requestId);
  const [gomokuError, setGomokuError] = useState<string | null>(null);
  const [gomokuLoading, setGomokuLoading] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModuleTab>("chat");
  const [panelView, setPanelView] = useState<PanelView>(INITIAL_PANEL_SESSION.view);
  const [panelRevealRequestId, setPanelRevealRequestId] = useState(INITIAL_PANEL_SESSION.requestId);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettingsState>({
    openAtLogin: false,
    panelAlwaysOnTop: true,
    petDisplayMode: INITIAL_PET_DISPLAY_MODE,
    petAnimationsEnabled: INITIAL_PET_DISPLAY_MODE === "dynamic"
  });
  const [updateState, setUpdateState] = useState<XiaoELongUpdateState>({
    status: "idle",
    message: "",
    version: "0.0.0",
    progress: null,
    manual: false
  });
  const desktopRole = getDesktopRole();
  const currentUserId = currentUser?.id ?? null;
  const dailyQuestionId = dailyData?.question.id ?? null;

  const applyDesktopSettings = useCallback((settings: DesktopSettingsState): void => {
    const petDisplayMode = normalizePetDisplayMode(
      settings.petDisplayMode,
      settings.petAnimationsEnabled
    );
    const nextSettings = {
      ...settings,
      petDisplayMode,
      petAnimationsEnabled: petDisplayMode === "dynamic"
    };
    localStorage.setItem(PET_DISPLAY_MODE_STORAGE_KEY, petDisplayMode);
    localStorage.setItem(PET_ANIMATIONS_STORAGE_KEY, String(nextSettings.petAnimationsEnabled));
    setDesktopSettings(nextSettings);
  }, []);

  const handleStatusBarExtraHeight = useCallback((height: number): void => {
    if (desktopRole === "panel") {
      window.xiaoelongDesktop?.setPanelContentExtraHeight?.(height);
    }
  }, [desktopRole]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.xiaoelongDesktop?.clearPersistedAccessToken?.();
    socketRef.current?.disconnect();
    socketRef.current = null;
    pendingGomokuMoveIdsRef.current.clear();
    chatScrollMemoryRef.current = null;
    setToken(null);
    setCurrentUser(null);
    setPresenceUsers([]);
    setMessages([]);
    setDailyData(null);
    setMoodStatus(null);
    deityDataVersionRef.current += 1;
    setDeityData(null);
    setGomokuGames([]);
    setSelectedGameId(null);
    setPanelOpen(false);
    setPanelView("home");
    setDeleteConfirmOpen(false);
    setDetailsOpen(false);
    setAccountDeleting(false);
    setProfileSaving(false);
    setProfileError(null);
    setProfileSaved(false);
    setDeityError(null);
    setDeityLoading(false);
    setDeitySubmittingId(null);
    setSocketError(null);
    setSessionRestoreError(null);
  }, []);

  const loadDailyQuestion = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      return;
    }

    const silent = options?.silent ?? false;
    if (!silent) {
      setDailyLoading(true);
      setDailyError(null);
    }
    try {
      const today = await getTodayQuestion(token);
      setDailyData(today);
    } catch (error) {
      if (!silent) {
        setDailyError(error instanceof Error ? error.message : "加载每日一题失败。");
      }
    } finally {
      if (!silent) {
        setDailyLoading(false);
      }
    }
  }, [token]);

  const loadTodayMood = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const todayMood = await getTodayMood(token);
      setMoodStatus(todayMood);
    } catch {
      setMoodStatus(null);
    }
  }, [token]);

  const loadGomokuGames = useCallback(async () => {
    if (!token) {
      return;
    }

    setGomokuLoading(true);
    setGomokuError(null);
    try {
      const result = await getGomokuGames(token);
      setGomokuGames(result.games);
      setSelectedGameId((current) =>
        current !== null && result.games.some((game) => game.id === current)
          ? current
          : (result.games[0]?.id ?? null)
      );
    } catch (error) {
      setGomokuError(error instanceof Error ? error.message : "加载五子棋对局失败。");
    } finally {
      setGomokuLoading(false);
    }
  }, [token]);

  const loadDeityWorship = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      return null;
    }

    const dataVersion = deityDataVersionRef.current;
    const silent = options?.silent ?? false;
    if (!silent) {
      setDeityLoading(true);
      setDeityError(null);
    }
    try {
      const today = await getTodayDeityWorship(token);
      if (dataVersion !== deityDataVersionRef.current) {
        return null;
      }
      setDeityData(today);
      setDeityError(null);
      return today;
    } catch (error) {
      if (!silent && dataVersion === deityDataVersionRef.current) {
        setDeityError(error instanceof Error ? error.message : "加载神选状态失败。");
      }
      return null;
    } finally {
      if (!silent) {
        setDeityLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    if (desktopRole !== "divine") {
      return;
    }

    return window.xiaoelongDesktop?.onDivineData?.((session) => {
      if (
        session.requestId <= 0 ||
        session.requestId === appliedDivineSessionRequestIdRef.current
      ) {
        return;
      }
      appliedDivineSessionRequestIdRef.current = session.requestId;
      deityDataVersionRef.current += 1;
      setDeityData(session.data);
      setDeityError(null);
      setDeityLoading(false);
      setDeitySubmittingId(null);
      setDivineViewSession((current) => current + 1);
      setDivineRevealRequestId(session.requestId);
    });
  }, [desktopRole]);

  useEffect(() => {
    if (desktopRole === "divine" && deityData) {
      window.xiaoelongDesktop?.updateDivineSelectionData?.(deityData);
    }
  }, [deityData, desktopRole]);

  useLayoutEffect(() => {
    if (
      desktopRole !== "divine" ||
      booting ||
      !currentUser ||
      divineRevealRequestId <= 0
    ) {
      return;
    }
    return scheduleAfterNextPaint(() => {
      window.xiaoelongDesktop?.notifyDivineReady?.(divineRevealRequestId);
    });
  }, [booting, currentUser, desktopRole, divineRevealRequestId, divineViewSession]);

  useEffect(() => {
    let canceled = false;
    let retryTimer: number | null = null;

    function expireSession(): void {
      window.xiaoelongDesktop?.requestLogout?.();
      clearSession();
    }

    function retrySessionLater(): void {
      retryTimer = window.setTimeout(() => {
        if (!canceled) {
          setSessionRetryKey((current) => current + 1);
        }
      }, 5000);
    }

    async function bootstrapSession(): Promise<void> {
      if (!token) {
        setCurrentUser(null);
        setPresenceUsers([]);
        setMessages([]);
        setDailyData(null);
        setMoodStatus(null);
        setDeityData(null);
        setGomokuGames([]);
        setSessionRestoreError(null);
        setBooting(false);
        return;
      }

      setBooting(true);
      setSessionRestoreError(null);

      try {
        const meResponse = await getMe(token);
        if (canceled) {
          return;
        }

        setCurrentUser(meResponse.user);
        window.xiaoelongDesktop?.persistAccessToken?.(token);
      } catch (error) {
        if (!canceled) {
          if (isUnauthorizedError(error)) {
            expireSession();
          } else {
            setSessionRestoreError("暂时无法连接服务器，登录状态已保留，将自动重试。");
            retrySessionLater();
          }
        }
        if (!canceled) {
          setBooting(false);
        }
        return;
      }

      try {
        const history = await getRecentMessages(token, 50);
        if (canceled) {
          return;
        }
        setMessages(history.messages);
      } catch (error) {
        if (!canceled) {
          if (isUnauthorizedError(error)) {
            expireSession();
          } else {
            setSocketError("聊天记录暂时未加载，实时连接仍会继续重试。");
          }
        }
      } finally {
        if (!canceled) {
          setBooting(false);
        }
      }
    }

    void bootstrapSession();
    return () => {
      canceled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [token, sessionRetryKey, clearSession]);

  useEffect(() => {
    if (!token || currentUser) {
      return;
    }

    const retryWhenOnline = (): void => {
      setSessionRetryKey((current) => current + 1);
    };
    window.addEventListener("online", retryWhenOnline);
    return () => {
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [token, currentUser]);

  useEffect(() => {
    if (!token || !currentUserId || desktopRole === "auth") {
      return;
    }

    void loadTodayMood();

    if (desktopRole !== "avatar") {
      void loadDailyQuestion();
      void loadDeityWorship();
      void loadGomokuGames();
    }

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketError(null);
    });

    socket.on("connect_error", () => {
      setSocketError("实时连接失败，请稍后重试。");
    });

    socket.on("disconnect", () => {
      setSocketError("实时连接已断开，正在重连。");
    });

    socket.on("presence:init", (payload) => {
      setPresenceUsers(payload.users);
    });

    socket.on("presence:online", (payload) => {
      setPresenceUsers((prev) => applyPresenceDelta(prev, payload));
    });

    socket.on("presence:offline", (payload) => {
      setPresenceUsers((prev) => updatePresenceStatus(prev, payload.onlineUserIds));
    });

    socket.on("user:update", (payload) => {
      setPresenceUsers((prev) => applyUserUpdateToPresence(prev, payload.user));
      setMessages((prev) => applyUserUpdateToMessages(prev, payload.user));
      setDailyData((prev) => applyUserUpdateToDailyData(prev, payload.user));
      setGomokuGames((prev) => applyUserUpdateToGames(prev, payload.user));
      setCurrentUser((prev) => (prev?.id === payload.user.id ? payload.user : prev));
    });

    if (desktopRole !== "avatar") {
      socket.on("chat:message", (message) => {
        setMessages((prev) => dedupeMessages([...prev, message]));
      });

      socket.on("question:update", (payload) => {
        setDailyData((prev) => {
          if (!prev || prev.question.id !== payload.questionId) {
            return prev;
          }
          return {
            ...prev,
            stats: payload.stats
          };
        });
      });

      socket.on("deity:worship", (payload) => {
        setDeityData((prev) =>
          prev
            ? {
                ...prev,
                deities: prev.deities.map((deity) =>
                  deity.deityId === payload.deity.deityId ? payload.deity : deity
                )
              }
            : prev
        );
      });
    }

    socket.on("mood:update", (payload: DailyMoodUpdatePayload) => {
      setPresenceUsers((prev) => applyMoodUpdate(prev, payload.userId, payload.mood));
      if (payload.userId === currentUserId) {
        setMoodStatus((prev) => ({
          moodDay: payload.mood.moodDay,
          mood: payload.mood,
          options: prev?.options ?? [...MOOD_OPTIONS],
          shouldPrompt: false
        }));
      }
    });

    if (desktopRole !== "avatar") {
      socket.on("gomoku:update", (payload: GomokuUpdatePayload) => {
        setGomokuGames((prev) => upsertGame(prev, payload.game));
        setSelectedGameId((current) => current ?? payload.game.id);
      });

    }

    socket.on("gomoku:end", (payload: GomokuEndPayload) => {
      if (desktopRole !== "avatar") {
        setGomokuGames((prev) => upsertGame(prev, payload.game));
      }
      if (desktopRole === "avatar" || desktopRole === "single") {
        setPetReaction(getPetReaction(payload.game.id, payload.winner, currentUserId));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketError(null);
    };
  }, [token, currentUserId, desktopRole, loadTodayMood, loadDailyQuestion, loadDeityWorship, loadGomokuGames]);

  useEffect(() => {
    if (!profileSaved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setProfileSaved(false);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [profileSaved]);

  useEffect(() => {
    if (!token || !currentUser || desktopRole === "auth" || desktopRole === "avatar") {
      return;
    }

    const timer = window.setInterval(() => {
      void loadDailyQuestion({ silent: true });
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, currentUser, desktopRole, loadDailyQuestion]);

  useEffect(() => {
    if (
      !token ||
      !currentUser ||
      desktopRole === "auth" ||
      desktopRole === "avatar" ||
      activeTab !== "divine"
    ) {
      return;
    }

    void loadDeityWorship({ silent: true });
    const timer = window.setInterval(() => {
      void loadDeityWorship({ silent: true });
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, currentUser, desktopRole, activeTab, loadDeityWorship]);

  useEffect(() => {
    if (!window.xiaoelongDesktop?.isDesktop) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const panelViewCleanup = window.xiaoelongDesktop.onPanelViewChange?.((session) => {
      setPanelView(session.view);
      setPanelRevealRequestId(session.requestId);
    });
    const settingsCleanup = window.xiaoelongDesktop.onSettingsChange?.((settings) => {
      applyDesktopSettings(settings);
    });
    const loginCleanup = window.xiaoelongDesktop.onLogin?.((nextToken) => {
      if (!nextToken) {
        return;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      setToken(nextToken);
      setBooting(true);
    });
    const logoutCleanup = window.xiaoelongDesktop.onLogout?.(() => {
      clearSession();
    });
    const updateCleanup = window.xiaoelongDesktop.onUpdateState?.((state) => {
      setUpdateState(state);
    });
    const divineReturnCleanup = window.xiaoelongDesktop.onDivineReturn?.((state) => {
      if (state.data) {
        deityDataVersionRef.current += 1;
        setDeityData(state.data);
      }
      setPanelView("home");
      setActiveTab("divine");
      void loadDeityWorship({ silent: true });
    });

    if (panelViewCleanup) {
      cleanups.push(panelViewCleanup);
    }
    if (settingsCleanup) {
      cleanups.push(settingsCleanup);
    }
    if (loginCleanup) {
      cleanups.push(loginCleanup);
    }
    if (logoutCleanup) {
      cleanups.push(logoutCleanup);
    }
    if (updateCleanup) {
      cleanups.push(updateCleanup);
    }
    if (divineReturnCleanup) {
      cleanups.push(divineReturnCleanup);
    }

    void window.xiaoelongDesktop.getSettings?.().then((settings) => {
      applyDesktopSettings(settings);
    });
    void window.xiaoelongDesktop.getUpdateState?.().then((state) => {
      setUpdateState(state);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [applyDesktopSettings, clearSession, loadTodayMood, loadDeityWorship]);

  async function handleJoin(payload: {
    inviteCode: string;
    nickname: string;
    avatarFile: File | null;
  }): Promise<void> {
    setAuthLoading(true);
    setAuthError(null);

    const formData = new FormData();
    formData.append("inviteCode", payload.inviteCode);
    formData.append("nickname", payload.nickname);
    if (payload.avatarFile) {
      formData.append("avatar", payload.avatarFile);
    }

    try {
      const response = await joinWithInvite(formData);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
      window.xiaoelongDesktop?.notifyLogin?.(response.accessToken);
      setToken(response.accessToken);
      setCurrentUser(response.user);
      setBooting(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setAuthError(error.message);
      } else {
        setAuthError("加入失败，请重试。");
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleUpdateProfile(payload: { nickname: string; avatarFile: File | null }): Promise<void> {
    if (!token) {
      setProfileError("登录已失效，请重新打开小鳄龙。");
      return;
    }

    const nickname = payload.nickname.trim();
    if (!nickname) {
      setProfileError("昵称不能为空。");
      return;
    }

    const formData = new FormData();
    formData.append("nickname", nickname);
    if (payload.avatarFile) {
      formData.append("avatar", payload.avatarFile);
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      const response = await updateCurrentProfile(token, formData);
      setCurrentUser((prev) => (prev?.id === response.user.id ? response.user : prev));
      setPresenceUsers((prev) => applyUserUpdateToPresence(prev, response.user));
      setMessages((prev) => applyUserUpdateToMessages(prev, response.user));
      setDailyData((prev) => applyUserUpdateToDailyData(prev, response.user));
      setGomokuGames((prev) => applyUserUpdateToGames(prev, response.user));
      setProfileSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setProfileError(error.message);
      } else {
        setProfileError("保存资料失败，请重试。");
      }
    } finally {
      setProfileSaving(false);
    }
  }

  const handleSendMessage = useCallback(async (payload: {
    content: string;
    imageFile: File | null;
    fileFile: File | null;
  }): Promise<void> => {
    setSendError(null);

    const socket = socketRef.current;
    if (!socket) {
      setSendError("连接未建立，暂时无法发送。");
      throw new Error("Socket not connected.");
    }

    if (!token) {
      setSendError("登录已失效，请重新打开小鳄龙。");
      throw new Error("Missing token.");
    }

    try {
      if (payload.imageFile && payload.fileFile) {
        throw new Error("Only one attachment is allowed per message.");
      }

      let image: ChatImage | null = null;
      if (payload.imageFile) {
        const formData = new FormData();
        formData.append("image", payload.imageFile);
        const result = await uploadChatImage(token, formData);
        image = result.image;
      }

      let file: ChatFile | null = null;
      if (payload.fileFile) {
        const formData = new FormData();
        formData.append("file", payload.fileFile);
        const result = await uploadChatFile(token, formData);
        file = result.file;
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Message send timeout."));
          }
        }, 5000);

        socket.emit("chat:send", { content: payload.content, image, file }, (ack) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);

          if (!ack.ok) {
            reject(new Error(ack.error || "发送失败。"));
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "发送失败。");
      throw error;
    }
  }, [token]);

  const handleAnswerDaily = useCallback(async (answerIndex: number): Promise<void> => {
    if (!token || dailyQuestionId === null) {
      return;
    }

    setDailyError(null);
    try {
      const result = await submitTodayAnswer(token, {
        questionId: dailyQuestionId,
        answerIndex
      });
      setDailyData((prev) =>
        prev
          ? {
              ...prev,
              answeredIndex: result.answeredIndex,
              stats: result.stats,
              result: result.result
            }
          : prev
      );
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : "提交答案失败。");
    }
  }, [token, dailyQuestionId]);

  const handleSelectMood = useCallback(async (emoji: MoodEmoji): Promise<void> => {
    if (!token) {
      return;
    }

    setMoodLoading(true);
    try {
      const result = await setTodayMood(token, { emoji });
      setMoodStatus((prev) => ({
        moodDay: result.moodDay,
        mood: result.mood,
        options: prev?.options ?? DEFAULT_MOOD_OPTIONS,
        shouldPrompt: false
      }));
      setPresenceUsers((prev) => applyMoodUpdate(prev, result.mood.userId, result.mood));
    } finally {
      setMoodLoading(false);
    }
  }, [token]);

  const handleDeityWorship = useCallback(async (deityId: DeityId): Promise<DeityWorshipResponse | null> => {
    if (!token || deitySubmittingId !== null) {
      return null;
    }

    setDeitySubmittingId(deityId);
    setDeityError(null);
    try {
      const result = await submitDeityWorship(token, { deityId });
      deityDataVersionRef.current += 1;
      setDeityData(result);
      window.xiaoelongDesktop?.updateDivineSelectionData?.(result);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        await loadDeityWorship({ silent: true });
        setDeityError(null);
        return null;
      }
      setDeityError(error instanceof Error ? error.message : "膜拜失败，请稍后重试。");
      return null;
    } finally {
      setDeitySubmittingId(null);
    }
  }, [token, deitySubmittingId, loadDeityWorship]);

  const handleSelectDivineTab = useCallback(async (): Promise<void> => {
    setActiveTab("divine");
    const latest = await loadDeityWorship({ silent: true });
    if (
      desktopRole === "panel" &&
      latest &&
      latest.todayWorship === null &&
      window.xiaoelongDesktop?.openDivineSelection
    ) {
      void window.xiaoelongDesktop.openDivineSelection(latest);
    }
  }, [desktopRole, loadDeityWorship]);

  const handleInviteGomoku = useCallback(async (targetUserId: string): Promise<void> => {
    const socket = socketRef.current;
    if (!socket) {
      setGomokuError("连接未建立，无法发起邀请。");
      return;
    }

    setGomokuError(null);
    try {
      const result = await emitWithAck<{ game: GomokuGame }>(socket, "gomoku:invite", { targetUserId });
      setGomokuGames((prev) => upsertGame(prev, result.game));
      setSelectedGameId(result.game.id);
    } catch (error) {
      setGomokuError(error instanceof Error ? error.message : "发起邀请失败。");
    }
  }, []);

  const handleAcceptGomoku = useCallback(async (gameId: number): Promise<void> => {
    const socket = socketRef.current;
    if (!socket) {
      setGomokuError("连接未建立，无法接受邀请。");
      return;
    }

    setGomokuError(null);
    try {
      const result = await emitWithAck<{ game: GomokuGame }>(socket, "gomoku:accept", { gameId });
      setGomokuGames((prev) => upsertGame(prev, result.game));
      setSelectedGameId(result.game.id);
    } catch (error) {
      setGomokuError(error instanceof Error ? error.message : "接受邀请失败。");
    }
  }, []);

  const handleRejectGomoku = useCallback(async (gameId: number): Promise<void> => {
    const socket = socketRef.current;
    if (!socket) {
      setGomokuError("连接未建立，无法拒绝邀请。");
      return;
    }

    setGomokuError(null);
    try {
      const result = await emitWithAck<{ game: GomokuGame }>(socket, "gomoku:reject", { gameId });
      setGomokuGames((prev) => upsertGame(prev, result.game));
      setSelectedGameId(result.game.id);
    } catch (error) {
      setGomokuError(error instanceof Error ? error.message : "拒绝邀请失败。");
    }
  }, []);

  const handleMoveGomoku = useCallback(async (gameId: number, row: number, col: number): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket) {
      setGomokuError("连接未建立，无法落子。");
      return false;
    }
    if (pendingGomokuMoveIdsRef.current.has(gameId)) {
      return false;
    }

    pendingGomokuMoveIdsRef.current.add(gameId);
    setGomokuError(null);
    try {
      const result = await emitWithAck<{ game: GomokuGame }>(socket, "gomoku:move", { gameId, row, col });
      setGomokuGames((prev) => upsertGame(prev, result.game));
      return true;
    } catch (error) {
      setGomokuError(error instanceof Error ? error.message : "落子失败。");
      return false;
    } finally {
      pendingGomokuMoveIdsRef.current.delete(gameId);
    }
  }, []);

  function handleAvatarToggle(): void {
    const shouldCloseVisibleHome = panelView === "home" && panelOpen;
    setPanelView("home");
    if (window.xiaoelongDesktop?.toggleHomePanel) {
      setPanelOpen(!shouldCloseVisibleHome);
      window.xiaoelongDesktop.toggleHomePanel();
      return;
    }
    setPanelOpen((prev) => !prev);
  }

  function handleAvatarSettings(): void {
    const shouldCloseVisibleSettings = panelView === "settings" && panelOpen;
    setPanelView("settings");
    if (shouldCloseVisibleSettings) {
      setPanelOpen(false);
    }
    if (window.xiaoelongDesktop?.openSettingsPanel) {
      window.xiaoelongDesktop.openSettingsPanel();
      return;
    }
    setPanelOpen(true);
  }

  function handleHideAllWindows(): void {
    window.xiaoelongDesktop?.hideAllWindows?.();
  }

  async function handleToggleLoginAtStartup(): Promise<void> {
    const nextSettings = await window.xiaoelongDesktop?.setLoginAtStartup?.(!desktopSettings.openAtLogin);
    if (nextSettings) {
      applyDesktopSettings(nextSettings);
    }
  }

  async function handleTogglePanelTopmost(): Promise<void> {
    const nextSettings = await window.xiaoelongDesktop?.setPanelAlwaysOnTop?.(!desktopSettings.panelAlwaysOnTop);
    if (nextSettings) {
      applyDesktopSettings(nextSettings);
    }
  }

  async function handleCyclePetDisplayMode(): Promise<void> {
    const nextMode = getNextPetDisplayMode(desktopSettings.petDisplayMode);
    localStorage.setItem(PET_DISPLAY_MODE_STORAGE_KEY, nextMode);
    localStorage.setItem(PET_ANIMATIONS_STORAGE_KEY, String(nextMode === "dynamic"));
    setDesktopSettings((current) => ({
      ...current,
      petDisplayMode: nextMode,
      petAnimationsEnabled: nextMode === "dynamic"
    }));

    const nextSettings = await window.xiaoelongDesktop?.setPetDisplayMode?.(nextMode);
    if (nextSettings) {
      applyDesktopSettings(nextSettings);
    }
  }

  async function handleCheckForUpdates(): Promise<void> {
    try {
      const nextState = await window.xiaoelongDesktop?.checkForUpdates?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message: error instanceof Error ? error.message : "检查更新失败。",
        progress: null
      }));
    }
  }

  async function handleDownloadUpdate(): Promise<void> {
    try {
      const nextState = await window.xiaoelongDesktop?.downloadUpdate?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message: error instanceof Error ? error.message : "下载更新失败。",
        progress: null
      }));
    }
  }

  async function handleInstallUpdate(): Promise<void> {
    await window.xiaoelongDesktop?.installUpdate?.();
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!token) {
      if (window.xiaoelongDesktop?.requestLogout) {
        window.xiaoelongDesktop.requestLogout();
      }
      clearSession();
      return;
    }

    setAccountDeleting(true);
    try {
      await deleteCurrentUser(token);
      if (window.xiaoelongDesktop?.requestLogout) {
        window.xiaoelongDesktop.requestLogout();
      }
      clearSession();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "注销失败，请重试。");
    } finally {
      setAccountDeleting(false);
    }
  }

  useEffect(() => {
    if (
      !window.xiaoelongDesktop?.setWindowMode ||
      desktopRole === "panel" ||
      desktopRole === "avatar" ||
      desktopRole === "divine"
    ) {
      return;
    }
    if (booting) {
      return;
    }
    if (!currentUser) {
      window.xiaoelongDesktop.setWindowMode("auth");
      return;
    }
    if (desktopRole === "auth") {
      window.xiaoelongDesktop.setWindowMode("collapsed");
      return;
    }
    window.xiaoelongDesktop.setWindowMode(panelOpen ? "expanded" : "collapsed");
  }, [booting, currentUser, panelOpen, desktopRole]);

  useLayoutEffect(() => {
    if (desktopRole !== "panel" || booting || !currentUser || panelRevealRequestId <= 0) {
      return;
    }

    return scheduleAfterNextPaint(() => {
      window.xiaoelongDesktop?.notifyPanelReady?.(panelRevealRequestId);
    });
  }, [desktopRole, booting, currentUser, panelView, activeTab, panelRevealRequestId]);

  const moodOptions = moodStatus?.options ?? DEFAULT_MOOD_OPTIONS;
  const moodPrompt =
    desktopRole === "avatar" && !panelOpen && moodStatus?.shouldPrompt
      ? {
          options: moodOptions,
          selectedMood: moodStatus?.mood?.emoji ?? null,
          loading: moodLoading,
          onSelect: handleSelectMood
        }
      : undefined;
  const moodPromptVisible = Boolean(moodPrompt);

  useLayoutEffect(() => {
    if (desktopRole !== "avatar") {
      return;
    }

    window.xiaoelongDesktop?.setMoodPromptVisible?.(moodPromptVisible);
    return () => {
      window.xiaoelongDesktop?.setMoodPromptVisible?.(false);
    };
  }, [desktopRole, moodPromptVisible]);

  const homePanel = currentUser ? (
    <div className="panel">
      <header className="topbar">
        <h1>小鳄龙之家</h1>
      </header>

      {socketError ? <div className="connection-toast">{socketError}</div> : null}

      <StatusBar
        currentUserId={currentUser.id}
        users={presenceUsers}
        moodOptions={moodOptions}
        moodLoading={moodLoading}
        onSelectMood={handleSelectMood}
        onExtraHeightChange={desktopRole === "panel" ? handleStatusBarExtraHeight : undefined}
      />

      <nav className="module-tabs">
        <button type="button" className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>
          聊天
        </button>
        <button type="button" className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>
          每日一题
        </button>
        <button type="button" className={activeTab === "divine" ? "active" : ""} onClick={() => void handleSelectDivineTab()}>
          神选
        </button>
        <button type="button" className={activeTab === "gomoku" ? "active" : ""} onClick={() => setActiveTab("gomoku")}>
          五子棋
        </button>
      </nav>

      {activeTab === "chat" ? (
        <ChatPanel
          currentUserId={currentUser.id}
          messages={messages}
          sendError={sendError}
          scrollMemoryRef={chatScrollMemoryRef}
          onSendMessage={handleSendMessage}
        />
      ) : null}

      {activeTab === "daily" ? (
        <DailyQuestionPanel
          data={dailyData}
          loading={dailyLoading}
          error={dailyError}
          onRefresh={loadDailyQuestion}
          onAnswer={handleAnswerDaily}
        />
      ) : null}

      {activeTab === "divine" ? (
        <DivineSelectionPanel
          data={deityData}
          loading={deityLoading}
          error={deityError}
        />
      ) : null}

      {activeTab === "gomoku" ? (
        <GomokuPanel
          currentUser={currentUser}
          users={presenceUsers}
          games={gomokuGames}
          selectedGameId={selectedGameId}
          loading={gomokuLoading}
          error={gomokuError}
          onRefresh={loadGomokuGames}
          onSelectGame={setSelectedGameId}
          onInvite={handleInviteGomoku}
          onAccept={handleAcceptGomoku}
          onReject={handleRejectGomoku}
          onMove={handleMoveGomoku}
        />
      ) : null}
    </div>
  ) : null;

  const updateBusy = updateState.status === "checking" || updateState.status === "downloading";
  const updateAvailable = updateState.status === "available";
  const updateDownloaded = updateState.status === "downloaded";
  const showUpdateStatus = updateState.message.length > 0 || updateState.progress !== null;
  const appVersion = clientPackage.version;

  const settingsPanel = currentUser ? (
    <div className={`panel settings-panel ${deleteConfirmOpen || detailsOpen ? "confirming" : ""}`}>
      <div className="settings-content">
        <SettingsProfileForm
          user={currentUser}
          loading={profileSaving}
          error={profileError}
          saved={profileSaved}
          onSubmit={handleUpdateProfile}
        />
        <header className="topbar settings-topbar">
          <div className="panel-action-buttons" aria-label="设置操作">
            <button type="button" className="ghost-button" onClick={handleHideAllWindows}>
              隐藏小鳄龙
            </button>
            <button
              type="button"
              className={desktopSettings.openAtLogin ? "primary-soft-button" : "ghost-button"}
              onClick={() => void handleToggleLoginAtStartup()}
            >
              {desktopSettings.openAtLogin ? "已开机自启" : "开机自启"}
            </button>
            <button
              type="button"
              className={desktopSettings.panelAlwaysOnTop ? "primary-soft-button" : "ghost-button"}
              onClick={() => void handleTogglePanelTopmost()}
            >
              {desktopSettings.panelAlwaysOnTop ? "已置顶" : "置顶"}
            </button>
            <button
              type="button"
              className={desktopSettings.petDisplayMode === "dynamic" ? "primary-soft-button" : "ghost-button"}
              aria-label={`小鳄龙显示方式：${PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}，点击切换`}
              title="点击切换小鳄龙显示方式"
              onClick={() => void handleCyclePetDisplayMode()}
            >
              {PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}
            </button>
            <button
              type="button"
              className="ghost-button settings-detail-button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDetailsOpen(true);
              }}
            >
              详情
            </button>
            <button
              type="button"
              className={updateBusy ? "primary-soft-button" : "ghost-button"}
              disabled={updateBusy}
              onClick={() => void handleCheckForUpdates()}
            >
              {updateState.status === "checking" ? "检查中" : "检查更新"}
            </button>
            {updateAvailable ? (
              <button
                type="button"
                className="primary-soft-button"
                disabled={updateBusy}
                onClick={() => void handleDownloadUpdate()}
              >
                {updateState.manual ? "打开 DMG 下载" : "下载更新"}
              </button>
            ) : null}
            {updateDownloaded ? (
              <button type="button" className="primary-soft-button" onClick={() => void handleInstallUpdate()}>
                重启安装
              </button>
            ) : null}
            {showUpdateStatus ? (
              <div className="settings-update-status">
                <span>{updateState.message}</span>
                {updateState.progress !== null ? (
                  <span className="settings-update-progress">{updateState.progress}%</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <footer className="settings-bottom-bar">
          <button
            type="button"
            className="danger-button"
            disabled={accountDeleting}
            onClick={() => {
              setDetailsOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            {accountDeleting ? "注销中" : "注销"}
          </button>
          <p className="settings-app-version">版本 v{appVersion}</p>
        </footer>
      </div>

      {detailsOpen ? (
        <div className="settings-detail-layer" role="dialog" aria-modal="true" aria-label="项目详情">
          <div className="settings-detail-card">
            <div className="settings-detail-head">
              <h2>项目详情</h2>
              <button type="button" className="ghost-button" onClick={() => setDetailsOpen(false)}>
                关闭
              </button>
            </div>
            <div className="settings-detail-body">
              <p>
                小鳄龙之家是一个基于 React、TypeScript 与 Electron 的桌面组件项目。前端由 Vite 构建，桌宠窗口、主面板与图片查看器通过 Electron IPC 协作，界面状态由 React 组件集中管理。
              </p>
              <p>
                后端采用 Node.js、Express 与 Socket.IO，负责 REST 接口、实时事件、文件上传和数据持久化；公共数据结构沉淀在 shared 包中，保持前后端类型契约一致。
              </p>
              <p className="settings-detail-credit">制作：HJC by Codex</p>
              <p className="settings-detail-members">
                小鳄龙之家成员🥰：HJC、哆啦X梦、莴韭、can you feel my world、HSX、offset、夕惕
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div className="settings-confirm-layer" role="dialog" aria-modal="true" aria-label="确认注销">
          <div className="settings-confirm-card">
            <p>注销将删除该user所有记录</p>
            <div className="settings-confirm-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={accountDeleting}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={accountDeleting}
                onClick={() => void handleDeleteAccount()}
              >
                {accountDeleting ? "注销中" : "确定"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  ) : null;

  const panelContent = panelView === "settings" ? settingsPanel : homePanel;

  if (booting) {
    if (desktopRole === "avatar" || desktopRole === "panel" || desktopRole === "divine") {
      return <main className="page shell-page empty-page" />;
    }

    return (
      <main className="page auth-page loading-page">
        <p>加载中...</p>
      </main>
    );
  }

  if (!currentUser) {
    if (desktopRole === "avatar" || desktopRole === "panel" || desktopRole === "divine") {
      return <main className="page shell-page empty-page" />;
    }

    if (token) {
      return (
        <main className="page auth-page">
          <section className="join-card session-recovery-card" aria-live="polite">
            <h1>正在恢复登录</h1>
            <p>{sessionRestoreError || "正在验证已保存的登录状态，请稍候。"}</p>
            <button type="button" onClick={() => setSessionRetryKey((current) => current + 1)}>
              立即重试
            </button>
          </section>
        </main>
      );
    }

    return (
      <main className="page auth-page">
        <JoinForm loading={authLoading} error={authError} onSubmit={handleJoin} />
      </main>
    );
  }

  if (desktopRole === "panel") {
    return <main className="page shell-page panel-page">{panelContent}</main>;
  }

  if (desktopRole === "divine") {
    return (
      <FullScreenDivineSelection
        key={divineViewSession}
        data={deityData}
        loading={deityLoading}
        error={deityError || socketError}
        submittingDeityId={deitySubmittingId}
        onWorship={handleDeityWorship}
        onClose={(completed) => window.xiaoelongDesktop?.closeDivineSelection?.(completed)}
      />
    );
  }

  if (desktopRole === "avatar") {
    return (
      <main className="page shell-page avatar-page">
        <AvatarDock
          open={panelOpen}
          nickname={currentUser.nickname}
          displayMode={desktopSettings.petDisplayMode}
          moodPrompt={moodPrompt}
          reaction={petReaction}
          onToggle={handleAvatarToggle}
          onSettings={handleAvatarSettings}
        />
      </main>
    );
  }

  return (
    <main className="page shell-page">
      <AvatarDock
        open={panelOpen}
        nickname={currentUser.nickname}
        displayMode={desktopSettings.petDisplayMode}
        reaction={desktopRole === "single" ? petReaction : null}
        onToggle={handleAvatarToggle}
        onSettings={handleAvatarSettings}
      />

      {panelOpen ? panelContent : null}
    </main>
  );
}
