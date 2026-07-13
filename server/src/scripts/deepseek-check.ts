import { env } from "../config/env.js";
import { createQuestionGeneratorProvider } from "../services/question-generator/deepseek-provider.js";

interface ModelListResponse {
  data?: Array<{ id?: string }>;
}

function getDeepSeekUrl(pathname: string): URL {
  const baseUrl = env.DEEPSEEK_BASE_URL.endsWith("/")
    ? env.DEEPSEEK_BASE_URL
    : `${env.DEEPSEEK_BASE_URL}/`;
  return new URL(pathname, baseUrl);
}

async function checkAvailableModels(apiKey: string): Promise<string[]> {
  const response = await fetch(getDeepSeekUrl("models"), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    }
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `DeepSeek model check failed: ${response.status}${responseText ? ` ${responseText.slice(0, 600)}` : ""}`
    );
  }

  let payload: ModelListResponse;
  try {
    payload = JSON.parse(responseText) as ModelListResponse;
  } catch {
    throw new Error("DeepSeek model check returned invalid JSON.");
  }

  return (payload.data ?? [])
    .map((model) => model.id)
    .filter((modelId): modelId is string => typeof modelId === "string" && modelId.length > 0);
}

async function run(): Promise<void> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  console.log(`[DeepSeekCheck] Base URL: ${env.DEEPSEEK_BASE_URL}`);
  console.log(`[DeepSeekCheck] Model: ${env.DEEPSEEK_MODEL}`);

  const models = await checkAvailableModels(apiKey);
  if (!models.includes(env.DEEPSEEK_MODEL)) {
    throw new Error(
      `Configured model ${env.DEEPSEEK_MODEL} is not available. Available models: ${models.join(", ") || "none"}.`
    );
  }
  console.log(`[DeepSeekCheck] Authentication succeeded. Available models: ${models.join(", ")}.`);

  const generated = await createQuestionGeneratorProvider().generate({
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: env.QUESTION_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date()),
    avoidQuestions: []
  });

  console.log("[DeepSeekCheck] Generated question passed schema validation.");
  console.log(JSON.stringify({
    category: generated.category,
    question: generated.question,
    options: generated.options,
    sourceContext: generated.sourceContext
  }, null, 2));
}

void run().catch((error: unknown) => {
  console.error(
    `[DeepSeekCheck] Failed: ${error instanceof Error ? error.message : "Unknown DeepSeek check error."}`
  );
  process.exitCode = 1;
});
