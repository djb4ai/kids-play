import type {
  AdaptiveGenerationContext,
  DifficultyLevel,
  GameSession,
  GameplayEvent,
  Recommendation,
  SaveSessionRequest,
  Skill
} from "@kids-play/shared";

export type CompletedSessionMetrics = {
  score: number;
  totalTasks: number;
  correctAnswers: number;
  incorrectAnswers: number;
  retries: number;
  hintsUsed: number;
  accuracy: number;
  averageResponseTimeMs: number | null;
  durationMs: number;
  commonMistakes: string[];
  lateRoundDrop: boolean;
};

type RecommendationInput = {
  childId: string;
  skill: Skill;
  currentLevel: DifficultyLevel;
  metrics: CompletedSessionMetrics;
  now: Date;
};

const RESPONSE_FAST_MS = 2_500;

export function calculateSessionMetrics(
  session: GameSession,
  request: SaveSessionRequest
): CompletedSessionMetrics {
  const answerEvents = request.events.filter(
    (event) => event.eventType === "answer_submitted"
  );
  const correctAnswerEvents = answerEvents.filter((event) => event.isCorrect === true);
  const incorrectAnswerEvents = answerEvents.filter(
    (event) => event.isCorrect === false
  );
  const responseTimes = answerEvents
    .map((event) => event.responseTimeMs)
    .filter((value): value is number => typeof value === "number");
  const answerCount = answerEvents.length;
  const accuracy =
    answerCount > 0
      ? correctAnswerEvents.length / answerCount
      : request.summary.correct / request.summary.total;

  return {
    score: request.summary.correct,
    totalTasks: request.summary.total,
    correctAnswers: correctAnswerEvents.length || request.summary.correct,
    incorrectAnswers: incorrectAnswerEvents.length,
    retries: incorrectAnswerEvents.length,
    hintsUsed: request.events.filter((event) => event.eventType === "hint_used").length,
    accuracy: roundMetric(accuracy),
    averageResponseTimeMs:
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((total, value) => total + value, 0) /
              responseTimes.length
          )
        : null,
    durationMs: Math.max(
      0,
      Date.parse(request.endedAt) - Date.parse(request.startedAt)
    ),
    commonMistakes: findCommonMistakes(incorrectAnswerEvents),
    lateRoundDrop: hasLateRoundDrop(incorrectAnswerEvents, session.rounds.length)
  };
}

export function buildRecommendation({
  childId,
  skill,
  currentLevel,
  metrics,
  now
}: RecommendationInput): Recommendation {
  const suggestedDifficultyLevel = chooseDifficultyLevel(currentLevel, metrics);
  const mistakeText =
    metrics.commonMistakes.length > 0
      ? metrics.commonMistakes.join(", ")
      : "the latest practice";
  const summary = buildSummary(skill, metrics, mistakeText);

  return {
    id: `rec_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    childId,
    skill,
    summary,
    nextFocus: buildNextFocus(skill, metrics, mistakeText),
    suggestedDifficultyLevel,
    createdAt: now.toISOString()
  };
}

export function buildAdaptiveContext(input: {
  childId: string;
  skill: Skill;
  targetDifficultyLevel: DifficultyLevel;
  lastSession:
    | {
        accuracy: number;
        averageResponseTimeMs: number | null;
        commonMistakes: string[];
      }
    | null;
  recommendation: Recommendation | null;
}): AdaptiveGenerationContext {
  return {
    childId: input.childId,
    skill: input.skill,
    targetDifficultyLevel: input.targetDifficultyLevel,
    recentTrend: getRecentTrend(input.lastSession),
    lastSession: input.lastSession
      ? {
          accuracy: input.lastSession.accuracy,
          commonMistakes: input.lastSession.commonMistakes,
          averageResponseTimeMs: input.lastSession.averageResponseTimeMs
        }
      : null,
    recommendation: input.recommendation
      ? {
          focus: input.recommendation.nextFocus,
          summary: input.recommendation.summary,
          difficultyLevel: input.recommendation.suggestedDifficultyLevel
        }
      : null
  };
}

export function getSkillStrengths(skill: Skill, metrics: CompletedSessionMetrics) {
  if (metrics.accuracy >= 0.85) {
    if (skill === "reading") {
      return ["matching familiar words"];
    }
    if (skill === "memory") {
      return ["remembering short sequences"];
    }
    return ["finding the target"];
  }

  if (metrics.accuracy >= 0.6) {
    return ["staying with the round"];
  }

  return [];
}

export function getSkillSupportAreas(
  skill: Skill,
  metrics: CompletedSessionMetrics
) {
  const supportAreas: string[] = [];

  if (metrics.accuracy < 0.6) {
    if (skill === "reading") {
      supportAreas.push("short word matching");
    } else if (skill === "memory") {
      supportAreas.push("shorter sequences");
    } else {
      supportAreas.push("fewer distractors");
    }
  }

  if (metrics.commonMistakes.length > 0) {
    supportAreas.push(`repeat ${metrics.commonMistakes.join(", ")}`);
  }

  if (metrics.lateRoundDrop) {
    supportAreas.push("shorter rounds");
  }

  return supportAreas;
}

function findCommonMistakes(events: GameplayEvent[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    const key =
      event.correctAnswer ?? event.questionOrItem ?? event.selectedAnswer ?? null;
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([itemId]) => itemId);
}

function hasLateRoundDrop(events: GameplayEvent[], roundCount: number) {
  if (roundCount < 2 || events.length === 0) {
    return false;
  }

  const midpoint = Math.ceil(roundCount / 2);
  const earlyErrors = events.filter(
    (event) => typeof event.roundIndex === "number" && event.roundIndex < midpoint
  ).length;
  const lateErrors = events.filter(
    (event) => typeof event.roundIndex === "number" && event.roundIndex >= midpoint
  ).length;

  return lateErrors > earlyErrors && lateErrors > 0;
}

function chooseDifficultyLevel(
  currentLevel: DifficultyLevel,
  metrics: CompletedSessionMetrics
): DifficultyLevel {
  if (metrics.accuracy < 0.6 || metrics.commonMistakes.length >= 2) {
    return clampDifficulty(currentLevel - 1);
  }

  if (
    metrics.accuracy >= 0.85 &&
    metrics.incorrectAnswers === 0 &&
    (metrics.averageResponseTimeMs === null ||
      metrics.averageResponseTimeMs <= RESPONSE_FAST_MS)
  ) {
    return clampDifficulty(currentLevel + 1);
  }

  return currentLevel;
}

function buildSummary(
  skill: Skill,
  metrics: CompletedSessionMetrics,
  mistakeText: string
) {
  if (metrics.accuracy < 0.6) {
    return `${titleCase(skill)} needs gentle support with ${mistakeText}.`;
  }

  if (metrics.accuracy >= 0.85 && metrics.incorrectAnswers === 0) {
    return `${titleCase(skill)} looked strong in the last session.`;
  }

  return `${titleCase(skill)} is steady and should keep practicing ${mistakeText}.`;
}

function buildNextFocus(
  skill: Skill,
  metrics: CompletedSessionMetrics,
  mistakeText: string
) {
  if (skill === "reading") {
    return metrics.accuracy < 0.6
      ? `repeat ${mistakeText} with fewer choices`
      : "mix familiar words with one small new challenge";
  }

  if (skill === "memory") {
    return metrics.accuracy < 0.6
      ? "repeat two-item sequences with slower pacing"
      : "practice one slightly longer sequence";
  }

  if (metrics.lateRoundDrop || metrics.accuracy < 0.6) {
    return "use shorter attention rounds with fewer distractors";
  }

  return "keep target finding steady with a small new distractor";
}

function getRecentTrend(
  lastSession: { accuracy: number; averageResponseTimeMs: number | null } | null
): AdaptiveGenerationContext["recentTrend"] {
  if (!lastSession) {
    return "new";
  }

  if (lastSession.accuracy < 0.6) {
    return "needs_support";
  }

  if (
    lastSession.accuracy >= 0.85 &&
    (lastSession.averageResponseTimeMs === null ||
      lastSession.averageResponseTimeMs <= RESPONSE_FAST_MS)
  ) {
    return "ready_for_more";
  }

  return "steady";
}

function clampDifficulty(level: number): DifficultyLevel {
  return Math.min(3, Math.max(1, level)) as DifficultyLevel;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function titleCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
