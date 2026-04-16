import type {
  FeedbackSet,
  GameItem,
  GameRound,
  GameRuntimeEvent,
  GameSession,
  TemplateType
} from "@kids-play/shared";
import { TEMPLATE_TYPES } from "@kids-play/shared";

export type {
  FeedbackSet,
  GameItem,
  GameRound,
  GameRuntimeEvent,
  GameSession,
  TemplateType
};

const templateTypes = new Set<TemplateType>(TEMPLATE_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isGameItem(value: unknown): value is GameItem {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.label) &&
    isString(value.imageKey) &&
    (value.value === undefined || isString(value.value))
  );
}

function isGameRound(value: unknown): value is GameRound {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.prompt) &&
    isStringArray(value.choices) &&
    value.choices.length >= 2 &&
    value.choices.every(isString) &&
    (value.correctChoice === undefined || isString(value.correctChoice)) &&
    (value.sequence === undefined || isStringArray(value.sequence)) &&
    (value.correctSequence === undefined || isStringArray(value.correctSequence))
  );
}

function isFeedbackSet(value: unknown): value is FeedbackSet {
  return (
    isRecord(value) &&
    isStringArray(value.correct) &&
    isStringArray(value.tryAgain) &&
    isStringArray(value.complete) &&
    value.correct.length > 0 &&
    value.tryAgain.length > 0 &&
    value.complete.length > 0
  );
}

export function isGameSession(value: unknown): value is GameSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.gameId) &&
    isString(value.skill) &&
    (value.skill === "reading" || value.skill === "memory" || value.skill === "attention") &&
    isString(value.templateType) &&
    templateTypes.has(value.templateType as TemplateType) &&
    isString(value.title) &&
    isString(value.instructions) &&
    Array.isArray(value.items) &&
    value.items.every(isGameItem) &&
    Array.isArray(value.rounds) &&
    value.rounds.every(isGameRound) &&
    isFeedbackSet(value.feedback) &&
    value.ageGroup === "5-8" &&
    value.difficulty === "beginner" &&
    isString(value.runtimeUrl) &&
    value.launchMode === "embed" &&
    isString(value.createdAt)
  );
}
