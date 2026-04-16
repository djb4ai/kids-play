import { z } from "zod";
import type { Recommendation, Skill } from "@kids-play/shared";
import type { CompletedSessionMetrics } from "./adaptation";

type InsightInput = {
  skill: Skill;
  currentRecommendation: Recommendation;
  metrics: CompletedSessionMetrics;
};

const insightSchema = z
  .object({
    summary: z.string().trim().min(8).max(180),
    nextFocus: z.string().trim().min(8).max(160)
  })
  .strict();

type OpenAIInsight = z.infer<typeof insightSchema>;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INSIGHTS_MODEL = "gpt-5-nano";

export async function generateOpenAIProgressInsight({
  skill,
  currentRecommendation,
  metrics
}: InsightInput): Promise<OpenAIInsight | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL?.trim() || DEFAULT_INSIGHTS_MODEL;

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: [
          "You write progress insights for a child-friendly learning game demo.",
          "Use only the provided metrics and recommendation.",
          "Do not make medical, diagnostic, or developmental claims.",
          "Keep the tone warm, concrete, and non-punitive.",
          "Return JSON only with summary and nextFocus."
        ].join(" "),
        input: JSON.stringify({
          skill,
          metrics: {
            accuracy: metrics.accuracy,
            incorrectAnswers: metrics.incorrectAnswers,
            retries: metrics.retries,
            hintsUsed: metrics.hintsUsed,
            averageResponseTimeMs: metrics.averageResponseTimeMs,
            commonMistakes: metrics.commonMistakes,
            lateRoundDrop: metrics.lateRoundDrop
          },
          ruleBasedRecommendation: {
            summary: currentRecommendation.summary,
            nextFocus: currentRecommendation.nextFocus,
            suggestedDifficultyLevel:
              currentRecommendation.suggestedDifficultyLevel
          }
        }),
        max_output_tokens: 220
      })
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn(
        "[kids-play] OpenAI insight generation failed",
        response.status,
        message.slice(0, 160)
      );
      return null;
    }

    const payload = (await response.json()) as unknown;
    const text = extractResponseText(payload);
    if (!text) {
      return null;
    }

    return insightSchema.parse(JSON.parse(stripJsonFence(text)));
  } catch (error) {
    console.warn("[kids-play] OpenAI insight generation unavailable", error);
    return null;
  }
}

export function applyInsightToRecommendation(
  recommendation: Recommendation,
  insight: OpenAIInsight | null
): Recommendation {
  if (!insight) {
    return recommendation;
  }

  return {
    ...recommendation,
    summary: insight.summary,
    nextFocus: insight.nextFocus
  };
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = payload as Record<string, unknown>;
  if (typeof value.output_text === "string") {
    return value.output_text;
  }

  if (!Array.isArray(value.output)) {
    return null;
  }

  const parts: string[] = [];
  for (const item of value.output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") {
        continue;
      }

      const text = (chunk as Record<string, unknown>).text;
      if (typeof text === "string") {
        parts.push(text);
      }
    }
  }

  return parts.join("\n").trim() || null;
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
