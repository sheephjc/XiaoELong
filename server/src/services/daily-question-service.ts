import type { DailyQuestion, DailyQuestionResult, DailyQuestionStats } from "@xiaoelong/shared";
import { env } from "../config/env.js";
import {
  createDailyQuestion,
  type DailyQuestionRecord,
  getDailyAnswerIndexByUser,
  getDailyQuestionByDate,
  getDailyQuestionById,
  getDailyQuestionStats,
  listRecentQuestionTexts,
  submitDailyAnswer,
  toPublicDailyQuestion
} from "../db/daily-questions.js";
import { getResetDayInTimezone } from "../utils/time.js";
import {
  createFallbackQuestionGeneratorProvider,
  createQuestionGeneratorProvider
} from "./question-generator/deepseek-provider.js";

const QUESTION_RESET_HOUR = 8;

export class DailyQuestionValidationError extends Error {}

function buildQuestionResult(question: DailyQuestionRecord, answeredIndex: number): DailyQuestionResult | null {
  if (!question.hasAnswerKey) {
    return null;
  }

  return {
    answeredIndex,
    correctAnswerIndex: question.correctAnswerIndex,
    isCorrect: answeredIndex === question.correctAnswerIndex,
    explanation: question.explanation
  };
}

function normalizeQuestion(question: string): string {
  return question.replace(/\s+/g, "").trim();
}

function isRepeatedQuestion(question: string, recentQuestions: string[]): boolean {
  const normalized = normalizeQuestion(question);
  return recentQuestions.some((recent) => normalizeQuestion(recent) === normalized);
}

export class DailyQuestionService {
  async ensureQuestionForDate(date: string): Promise<DailyQuestionRecord> {
    const existing = await getDailyQuestionByDate(date);
    if (existing) {
      return existing;
    }

    const avoidQuestions = await listRecentQuestionTexts(date, 10);

    try {
      const provider = createQuestionGeneratorProvider();
      const generated = await provider.generate({ date, avoidQuestions });
      if (isRepeatedQuestion(generated.question, avoidQuestions)) {
        throw new Error("Generated question repeated a recent question.");
      }
      return await createDailyQuestion({
        date,
        category: generated.category,
        question: generated.question,
        options: generated.options,
        visual: generated.visual,
        correctAnswerIndex: generated.correctAnswerIndex,
        explanation: generated.explanation,
        sourceType: "online",
        sourceContext: generated.sourceContext
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      console.error(
        `[DailyQuestion] DeepSeek generation failed for ${date} (model: ${env.DEEPSEEK_MODEL}); using local fallback: ${reason}`
      );
      const fallbackProvider = createFallbackQuestionGeneratorProvider();
      const generated = await fallbackProvider.generate({ date, avoidQuestions });
      return await createDailyQuestion({
        date,
        category: generated.category,
        question: generated.question,
        options: generated.options,
        visual: generated.visual,
        correctAnswerIndex: generated.correctAnswerIndex,
        explanation: generated.explanation,
        sourceType: "fallback",
        sourceContext: JSON.stringify({
          provider: "local-fallback",
          model: env.DEEPSEEK_MODEL,
          reason
        })
      });
    }
  }

  async ensureTodayQuestion(): Promise<DailyQuestionRecord> {
    const date = getResetDayInTimezone(new Date(), env.QUESTION_TIMEZONE, QUESTION_RESET_HOUR);
    return this.ensureQuestionForDate(date);
  }

  async getQuestionWithStatsForUser(userId: string): Promise<{
    question: DailyQuestion;
    stats: DailyQuestionStats;
    answeredIndex: number | null;
    result: DailyQuestionResult | null;
  }> {
    const question = await this.ensureTodayQuestion();
    const stats = await getDailyQuestionStats(question.id, question.options.length);
    const answeredIndex = await getDailyAnswerIndexByUser(question.id, userId);

    return {
      question: toPublicDailyQuestion(question),
      stats,
      answeredIndex,
      result: answeredIndex === null ? null : buildQuestionResult(question, answeredIndex)
    };
  }

  async submitAnswer(questionId: number, userId: string, answerIndex: number): Promise<{
    question: DailyQuestion;
    stats: DailyQuestionStats;
    answeredIndex: number;
    result: DailyQuestionResult | null;
  }> {
    const question = await getDailyQuestionById(questionId);
    if (!question) {
      throw new DailyQuestionValidationError("Question not found.");
    }
    if (answerIndex < 0 || answerIndex >= question.options.length) {
      throw new DailyQuestionValidationError("Answer index out of range.");
    }

    try {
      await submitDailyAnswer(questionId, userId, answerIndex);
    } catch (error) {
      if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
        throw new DailyQuestionValidationError("You have already answered this question.");
      }
      throw error;
    }

    const stats = await getDailyQuestionStats(questionId, question.options.length);
    return {
      question: toPublicDailyQuestion(question),
      stats,
      answeredIndex: answerIndex,
      result: buildQuestionResult(question, answerIndex)
    };
  }

  async getStats(questionId: number): Promise<DailyQuestionStats> {
    const question = await getDailyQuestionById(questionId);
    if (!question) {
      throw new DailyQuestionValidationError("Question not found.");
    }
    return getDailyQuestionStats(questionId, question.options.length);
  }
}
