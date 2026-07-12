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
