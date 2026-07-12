import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1).default("xiaoelong"),
  DB_PASSWORD: z.string().default("xiaoelong"),
  DB_NAME: z.string().min(1).default("XiaoELong"),
  INVITE_CODE: z.string().trim().min(1),
  JWT_SECRET: z.string().trim().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default("30d"),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(1000),
  MAX_AVATAR_SIZE_MB: z.coerce.number().positive().default(3),
  MAX_CHAT_IMAGE_SIZE_MB: z.coerce.number().positive().default(5),
  MAX_CHAT_FILE_SIZE_MB: z.coerce.number().positive().default(50),
  UPLOAD_ROOT: z.string().trim().optional(),
  UPDATE_ROOT: z.string().trim().optional(),
  DEEPSEEK_API_KEY: z.string().trim().optional(),
  DEEPSEEK_BASE_URL: z.string().trim().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().trim().min(1).default("deepseek-v4-flash"),
  QUESTION_CRON: z.string().trim().min(1).default("0 8 * * *"),
  QUESTION_TIMEZONE: z.string().trim().min(1).default("Asia/Shanghai")
});

export const env = envSchema.parse(process.env);
