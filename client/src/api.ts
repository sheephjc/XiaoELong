import type {
  AuthJoinResponse,
  AuthDeleteResponse,
  AuthMeResponse,
  AuthProfileUpdateResponse,
  ChatFileUploadResponse,
  ChatImageUploadResponse,
  ChatHistoryResponse,
  DailyQuestionAnswerResponse,
  DailyQuestionTodayResponse,
  DailyMoodSetPayload,
  DailyMoodSetResponse,
  DailyMoodTodayResponse,
  DeityWorshipPayload,
  DeityWorshipResponse,
  DeityWorshipTodayResponse,
  GomokuGamesResponse
} from "@xiaoelong/shared";
import { serverUrl } from "./env";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  token?: string;
  body?: BodyInit | null;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${serverUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ?? null
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(response.status, payload.message || "Request failed.");
  }

  return payload as T;
}

export async function joinWithInvite(formData: FormData): Promise<AuthJoinResponse> {
  return requestJson<AuthJoinResponse>("/api/auth/join", {
    method: "POST",
    body: formData
  });
}

export async function getMe(token: string): Promise<AuthMeResponse> {
  return requestJson<AuthMeResponse>("/api/auth/me", {
    token
  });
}

export async function deleteCurrentUser(token: string): Promise<AuthDeleteResponse> {
  return requestJson<AuthDeleteResponse>("/api/auth/me", {
    method: "DELETE",
    token
  });
}

export async function updateCurrentProfile(token: string, formData: FormData): Promise<AuthProfileUpdateResponse> {
  return requestJson<AuthProfileUpdateResponse>("/api/auth/me", {
    method: "PUT",
    token,
    body: formData
  });
}

export async function getRecentMessages(token: string, limit = 50): Promise<ChatHistoryResponse> {
  return requestJson<ChatHistoryResponse>(`/api/chat/messages?limit=${limit}`, {
    token
  });
}

export async function uploadChatImage(token: string, formData: FormData): Promise<ChatImageUploadResponse> {
  return requestJson<ChatImageUploadResponse>("/api/chat/images", {
    method: "POST",
    token,
    body: formData
  });
}

export async function uploadChatFile(token: string, formData: FormData): Promise<ChatFileUploadResponse> {
  return requestJson<ChatFileUploadResponse>("/api/chat/files", {
    method: "POST",
    token,
    body: formData
  });
}

export async function getTodayQuestion(token: string): Promise<DailyQuestionTodayResponse> {
  return requestJson<DailyQuestionTodayResponse>("/api/daily-question/today", { token });
}

export async function submitTodayAnswer(
  token: string,
  payload: { questionId: number; answerIndex: number }
): Promise<DailyQuestionAnswerResponse> {
  return requestJson<DailyQuestionAnswerResponse>("/api/daily-question/answer", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function getTodayMood(token: string): Promise<DailyMoodTodayResponse> {
  return requestJson<DailyMoodTodayResponse>("/api/daily-mood/today", { token });
}

export async function setTodayMood(token: string, payload: DailyMoodSetPayload): Promise<DailyMoodSetResponse> {
  return requestJson<DailyMoodSetResponse>("/api/daily-mood", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function getTodayDeityWorship(token: string): Promise<DeityWorshipTodayResponse> {
  return requestJson<DeityWorshipTodayResponse>("/api/deity-worship/today", { token });
}

export async function submitDeityWorship(
  token: string,
  payload: DeityWorshipPayload
): Promise<DeityWorshipResponse> {
  return requestJson<DeityWorshipResponse>("/api/deity-worship", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function getGomokuGames(token: string): Promise<GomokuGamesResponse> {
  return requestJson<GomokuGamesResponse>("/api/gomoku/games", { token });
}
