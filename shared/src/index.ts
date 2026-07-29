export interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
}

export const MOOD_OPTIONS = ["😊", "🥰", "😌", "😎", "🥳", "🤔", "😐", "😮‍💨", "😴", "😟", "😞", "😭", "😡", "😤", "😱", "🤒"] as const;

export type MoodEmoji = (typeof MOOD_OPTIONS)[number];

export interface DailyMood {
  userId: string;
  moodDay: string;
  emoji: MoodEmoji;
  updatedAt: string;
}

export interface PresenceUser extends UserProfile {
  isOnline: boolean;
  todayMood: DailyMood | null;
}

export interface ChatImage {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatFile {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: number;
  user: UserProfile;
  content: string;
  image: ChatImage | null;
  file: ChatFile | null;
  createdAt: string;
}

export interface AuthJoinResponse {
  accessToken: string;
  user: UserProfile;
}

export interface AuthMeResponse {
  user: UserProfile;
}

export interface AuthProfileUpdateResponse {
  user: UserProfile;
}

export interface AuthDeleteResponse {
  ok: true;
  deletedUserId: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface ChatImageUploadResponse {
  image: ChatImage;
}

export interface ChatFileUploadResponse {
  file: ChatFile;
}

export type DailyQuestionVisual =
  | {
      type: "clock";
      data: {
        hour: number;
        minute: number;
      };
    }
  | {
      type: "venn2";
      data: {
        leftLabel: string;
        rightLabel: string;
        leftOnly: number;
        both: number;
        rightOnly: number;
        outside?: number;
      };
    }
  | {
      type: "pathGrid";
      data: {
        rows: number;
        cols: number;
        start: [number, number];
        end: [number, number];
        allowedMoves: Array<"right" | "down">;
      };
    }
  | {
      type: "barChart";
      data: {
        title?: string;
        items: Array<{
          label: string;
          value: number;
        }>;
      };
    }
  | {
      type: "logicTable";
      data: {
        people: string[];
        roles: string[];
        marks: Array<{
          person: string;
          role: string;
          value: boolean;
        }>;
      };
    }
  | {
      type: "triangle";
      data: {
        points: [string, string, string];
        equalSides?: Array<[string, string]>;
        angles?: Array<{
          point: string;
          degrees: number;
        }>;
        unknownAngleAt?: string;
      };
    };

export interface DailyQuestion {
  id: number;
  date: string;
  category: string;
  question: string;
  options: string[];
  visual: DailyQuestionVisual | null;
  sourceType: "online" | "fallback" | "manual";
  sourceContext: string | null;
  createdAt: string;
}

export interface DailyQuestionVoter extends UserProfile {
  answeredAt: string;
}

export interface DailyQuestionStats {
  questionId: number;
  counts: number[];
  totalAnswers: number;
  voters: DailyQuestionVoter[][];
}

export interface DailyQuestionResult {
  answeredIndex: number;
  correctAnswerIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface DailyQuestionTodayResponse {
  question: DailyQuestion;
  stats: DailyQuestionStats;
  answeredIndex: number | null;
  result: DailyQuestionResult | null;
}

export interface DailyQuestionAnswerResponse {
  ok: true;
  stats: DailyQuestionStats;
  answeredIndex: number;
  result: DailyQuestionResult | null;
}

export interface DailyMoodTodayResponse {
  moodDay: string;
  mood: DailyMood | null;
  options: MoodEmoji[];
  shouldPrompt: boolean;
}

export interface DailyMoodSetPayload {
  emoji: MoodEmoji;
}

export interface DailyMoodSetResponse {
  ok: true;
  moodDay: string;
  mood: DailyMood;
}

export const DEITY_CATALOG = [
  { id: "hu", name: "胡神", blessing: "百🦌不萎加护" },
  { id: "chui", name: "chui神", blessing: "愿你以虚实为牌，以奇迹为幕" },
  { id: "a", name: "A神", blessing: "中暑导致的" },
  { id: "mx", name: "mx神", blessing: "愿哆啦A梦赐你四次元的庇佑，口袋所开之处，困境皆化道具，未来皆通奇迹" },
  { id: "guo", name: "郭神", blessing: "愿你的 Prompt 唤醒 LLM 的星火，愿你的 Agent 穿行知识迷宫，为你取回命运的最优解" },
  { id: "chili", name: "🌶️神", blessing: "愿赤焰入魂，辛烈成冠；凡灼烧你者，终将铸成你的神格" },
  { id: "daimeng_hf", name: "呆萌HF", blessing: "愿无垢之光庇佑你，使世界不忍伤害你的天真，命运也为你的迟钝让路" }
] as const;

export type DeityId = (typeof DEITY_CATALOG)[number]["id"];

export type DeityRank = "mortal" | "demigod" | "true_god" | "main_god" | "creator_god";

export const DEITY_RANKS = [
  { id: "mortal", label: "凡人", minimum: 0, nextThreshold: 2 },
  { id: "demigod", label: "半神", minimum: 2, nextThreshold: 5 },
  { id: "true_god", label: "真神", minimum: 5, nextThreshold: 10 },
  { id: "main_god", label: "主神", minimum: 10, nextThreshold: 20 },
  { id: "creator_god", label: "创世神", minimum: 20, nextThreshold: null }
] as const satisfies ReadonlyArray<{
  id: DeityRank;
  label: string;
  minimum: number;
  nextThreshold: number | null;
}>;

export function getDeityRank(totalWorships: number): DeityRank {
  if (totalWorships >= 20) return "creator_god";
  if (totalWorships >= 10) return "main_god";
  if (totalWorships >= 5) return "true_god";
  if (totalWorships >= 2) return "demigod";
  return "mortal";
}

export function getDeityRankLabel(rank: DeityRank): string {
  return DEITY_RANKS.find((item) => item.id === rank)?.label ?? "凡人";
}

export function getNextDeityThreshold(rank: DeityRank): number | null {
  return DEITY_RANKS.find((item) => item.id === rank)?.nextThreshold ?? null;
}

export interface DeityStatus {
  deityId: DeityId;
  totalWorships: number;
  rank: DeityRank;
  nextThreshold: number | null;
}

export interface DeityWorshipRecord {
  deityId: DeityId;
  worshipDay: string;
  worshippedAt: string;
}

export interface DeityWorshipTodayResponse {
  worshipDay: string;
  todayWorship: DeityWorshipRecord | null;
  deities: DeityStatus[];
}

export interface DeityWorshipPayload {
  deityId: DeityId;
}

export interface DeityWorshipResponse extends DeityWorshipTodayResponse {
  ok: true;
  blessing: string;
  deity: DeityStatus;
  previousRank: DeityRank;
  rankAdvanced: boolean;
}

export interface DeityWorshipUpdatePayload {
  deity: DeityStatus;
}

export interface GomokuGame {
  id: number;
  status: "invited" | "playing" | "finished" | "declined";
  playerBlack: UserProfile;
  playerWhite: UserProfile;
  currentTurn: string | null;
  winner: string | null;
  boardState: number[][];
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GomokuGamesResponse {
  games: GomokuGame[];
}

export interface GomokuInviteResponse {
  game: GomokuGame;
}

export interface GomokuMoveResponse {
  game: GomokuGame;
}

export interface PresenceInitPayload {
  users: PresenceUser[];
}

export interface PresenceDeltaPayload {
  userId: string;
  onlineUserIds: string[];
  user?: PresenceUser;
}

export interface ChatSendPayload {
  content?: string;
  image?: ChatImage | null;
  file?: ChatFile | null;
}

export interface ChatSendAck {
  ok: boolean;
  error?: string;
}

export interface DailyQuestionUpdatePayload {
  questionId: number;
  stats: DailyQuestionStats;
}

export interface DailyMoodUpdatePayload {
  userId: string;
  mood: DailyMood;
}

export interface UserUpdatePayload {
  user: UserProfile;
}

export interface GomokuInvitePayload {
  targetUserId: string;
}

export interface GomokuAcceptPayload {
  gameId: number;
}

export interface GomokuRejectPayload {
  gameId: number;
}

export interface GomokuMovePayload {
  gameId: number;
  row: number;
  col: number;
}

export interface GomokuUpdatePayload {
  game: GomokuGame;
}

export interface GomokuEndPayload {
  game: GomokuGame;
  winner: string | null;
}

export interface BasicAck {
  ok: boolean;
  error?: string;
}

export interface GomokuAck extends BasicAck {
  game?: GomokuGame;
}

export interface ServerToClientEvents {
  "presence:init": (payload: PresenceInitPayload) => void;
  "presence:online": (payload: PresenceDeltaPayload) => void;
  "presence:offline": (payload: PresenceDeltaPayload) => void;
  "user:update": (payload: UserUpdatePayload) => void;
  "chat:message": (message: ChatMessage) => void;
  "question:update": (payload: DailyQuestionUpdatePayload) => void;
  "mood:update": (payload: DailyMoodUpdatePayload) => void;
  "deity:worship": (payload: DeityWorshipUpdatePayload) => void;
  "gomoku:update": (payload: GomokuUpdatePayload) => void;
  "gomoku:end": (payload: GomokuEndPayload) => void;
}

export interface ClientToServerEvents {
  "chat:send": (payload: ChatSendPayload, ack?: (result: ChatSendAck) => void) => void;
  "gomoku:invite": (payload: GomokuInvitePayload, ack?: (result: GomokuAck) => void) => void;
  "gomoku:accept": (payload: GomokuAcceptPayload, ack?: (result: GomokuAck) => void) => void;
  "gomoku:reject": (payload: GomokuRejectPayload, ack?: (result: GomokuAck) => void) => void;
  "gomoku:move": (payload: GomokuMovePayload, ack?: (result: GomokuAck) => void) => void;
}
