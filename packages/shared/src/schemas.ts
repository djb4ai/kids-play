import { z } from "zod";
import {
  AGE_GROUPS,
  DIFFICULTY_LEVELS,
  GENERATION_SOURCES,
  GAMEPLAY_EVENT_TYPES,
  IMAGE_KEYS,
  SKILLS,
  TEMPLATE_TYPES,
  type CodexGameOutput,
  type DifficultyLevel,
  type GenerateGameRequest,
  type SaveSessionRequest,
  type Skill,
  type TemplateType
} from "./types";

export const templateSkillMap: Record<TemplateType, Skill> = {
  reading_word_match: "reading",
  reading_picture_clue: "reading",
  memory_sequence: "memory",
  memory_shape_path: "memory",
  attention_target_tap: "attention",
  attention_shape_scan: "attention",
  attention_codex_surprise: "attention"
};

const memoryTemplateTypes = new Set<TemplateType>([
  "memory_sequence",
  "memory_shape_path"
]);

const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{1,31}$/, "Use a short lowercase id.");

export const difficultyLevelSchema = z.union([
  z.literal(DIFFICULTY_LEVELS[0]),
  z.literal(DIFFICULTY_LEVELS[1]),
  z.literal(DIFFICULTY_LEVELS[2])
]);

const feedbackLineSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .refine(
    (value) =>
      !/\b(no|wrong|bad|fail|failed|incorrect|mistake|lose|lost|poor)\b/i.test(
        value
      ),
    "Feedback must stay affirmative and non-punitive."
  );

export const generateGameRequestSchema = z
  .object({
    childId: idSchema.default("demo_child"),
    skill: z.enum(SKILLS),
    ageGroup: z.enum(AGE_GROUPS).default("5-8"),
    difficultyLevel: difficultyLevelSchema.default(1)
  })
  .strict();

export const gameItemSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1).max(24),
    imageKey: z.enum(IMAGE_KEYS),
    value: z.string().trim().min(1).max(18).optional()
  })
  .strict();

export const gameRoundSchema = z
  .object({
    id: idSchema,
    prompt: z.string().trim().min(6).max(90),
    choices: z.array(idSchema).min(2).max(8),
    correctChoice: idSchema.optional(),
    sequence: z.array(idSchema).min(2).max(5).optional(),
    correctSequence: z.array(idSchema).min(2).max(5).optional()
  })
  .strict();

const codexGameOutputBaseSchema = z
  .object({
    skill: z.enum(SKILLS),
    templateType: z.enum(TEMPLATE_TYPES),
    title: z.string().trim().min(3).max(42),
    instructions: z.string().trim().min(8).max(96),
    items: z.array(gameItemSchema).min(3).max(12),
    rounds: z.array(gameRoundSchema).min(3).max(5),
    feedback: z
      .object({
        correct: z.array(feedbackLineSchema).min(1).max(4),
        tryAgain: z.array(feedbackLineSchema).min(1).max(4),
        complete: z.array(feedbackLineSchema).min(1).max(4)
      })
      .strict()
  })
  .strict();

function checkGameOutput(
  value: z.infer<typeof codexGameOutputBaseSchema>,
  context: z.RefinementCtx
) {
    if (templateSkillMap[value.templateType] !== value.skill) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateType"],
        message: "Template type must match the selected skill."
      });
    }

    const itemIds = new Set(value.items.map((item) => item.id));

    for (const [roundIndex, round] of value.rounds.entries()) {
      const refPaths: Array<[string, string[] | undefined]> = [
        ["choices", round.choices],
        ["sequence", round.sequence],
        ["correctSequence", round.correctSequence]
      ];

      for (const [field, refs] of refPaths) {
        for (const [refIndex, ref] of (refs ?? []).entries()) {
          if (!itemIds.has(ref)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["rounds", roundIndex, field, refIndex],
              message: "Round references an unknown item id."
            });
          }
        }
      }

      if (
        round.correctChoice &&
        (!itemIds.has(round.correctChoice) ||
          !round.choices.includes(round.correctChoice))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rounds", roundIndex, "correctChoice"],
          message: "Correct choice must be one of this round's choices."
        });
      }

      if (memoryTemplateTypes.has(value.templateType)) {
        if (!round.sequence || !round.correctSequence) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rounds", roundIndex],
            message: "Memory rounds need a sequence and correctSequence."
          });
        } else if (round.sequence.join("|") !== round.correctSequence.join("|")) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rounds", roundIndex, "correctSequence"],
            message: "Memory correctSequence must match the shown sequence."
          });
        }
      } else if (!round.correctChoice) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rounds", roundIndex, "correctChoice"],
          message: "This template requires a correctChoice."
        });
      }
    }
}

export const codexGameOutputSchema =
  codexGameOutputBaseSchema.superRefine(checkGameOutput);

export const gameSessionSchema = codexGameOutputBaseSchema
  .extend({
    gameId: idSchema,
    childId: idSchema,
    ageGroup: z.enum(AGE_GROUPS),
    difficultyLevel: difficultyLevelSchema,
    generationSource: z.enum(GENERATION_SOURCES),
    runtimeUrl: z.string().url(),
    launchMode: z.literal("embed"),
    createdAt: z.string().datetime()
  })
  .superRefine(checkGameOutput);

export const gameplayEventSchema = z
  .object({
    eventType: z.enum(GAMEPLAY_EVENT_TYPES),
    roundIndex: z.number().int().nonnegative().optional(),
    questionOrItem: z.string().trim().min(1).max(64).optional(),
    selectedAnswer: z.string().trim().min(1).max(64).optional(),
    correctAnswer: z.string().trim().min(1).max(64).optional(),
    isCorrect: z.boolean().optional(),
    responseTimeMs: z.number().int().nonnegative().max(120_000).optional(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime()
  })
  .strict();

export const saveSessionRequestSchema = z
  .object({
    gameId: idSchema,
    childId: idSchema,
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    summary: z
      .object({
        correct: z.number().int().nonnegative(),
        total: z.number().int().positive()
      })
      .strict(),
    events: z.array(gameplayEventSchema).min(1).max(200)
  })
  .strict()
  .refine(
    (value) => Date.parse(value.endedAt) >= Date.parse(value.startedAt),
    {
      path: ["endedAt"],
      message: "Session end must be after the start."
    }
  );

export const codexOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "skill",
    "templateType",
    "title",
    "instructions",
    "items",
    "rounds",
    "feedback"
  ],
  properties: {
    skill: { enum: SKILLS },
    templateType: { enum: TEMPLATE_TYPES },
    title: { type: "string" },
    instructions: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "imageKey", "value"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          imageKey: { enum: IMAGE_KEYS },
          value: { type: "string" }
        }
      }
    },
    rounds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "prompt",
          "choices",
          "correctChoice",
          "sequence",
          "correctSequence"
        ],
        properties: {
          id: { type: "string" },
          prompt: { type: "string" },
          choices: {
            type: "array",
            items: { type: "string" }
          },
          correctChoice: {
            type: "string"
          },
          sequence: {
            type: "array",
            items: { type: "string" }
          },
          correctSequence: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["correct", "tryAgain", "complete"],
      properties: {
        correct: {
          type: "array",
          items: { type: "string" }
        },
        tryAgain: {
          type: "array",
          items: { type: "string" }
        },
        complete: {
          type: "array",
          items: { type: "string" }
        }
      }
    }
  }
} as const;

export function parseGenerateGameRequest(input: unknown): GenerateGameRequest {
  return generateGameRequestSchema.parse(input);
}

export function parseDifficultyLevel(input: unknown): DifficultyLevel {
  return difficultyLevelSchema.parse(input);
}

export function parseSaveSessionRequest(input: unknown): SaveSessionRequest {
  return saveSessionRequestSchema.parse(input);
}

export function parseCodexGameOutput(input: unknown): CodexGameOutput {
  return codexGameOutputSchema.parse(normalizeCodexOutput(input));
}

function normalizeCodexOutput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const value = input as Record<string, unknown>;

  return {
    ...value,
    items: Array.isArray(value.items)
      ? value.items.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return item;
          }

          const normalized = { ...(item as Record<string, unknown>) };
          if (normalized.value === "" || normalized.value === null) {
            delete normalized.value;
          }
          return normalized;
        })
      : value.items,
    rounds: Array.isArray(value.rounds)
      ? value.rounds.map((round) => {
          if (!round || typeof round !== "object" || Array.isArray(round)) {
            return round;
          }

          const normalized = { ...(round as Record<string, unknown>) };
          if (
            !normalized.correctChoice &&
            Array.isArray(normalized.correctChoices) &&
            normalized.correctChoices.length > 0
          ) {
            normalized.correctChoice = normalized.correctChoices[0];
          }
          if (normalized.correctChoice === "" || normalized.correctChoice === null) {
            delete normalized.correctChoice;
          }
          delete normalized.correctChoices;
          if (
            normalized.sequence === null ||
            (Array.isArray(normalized.sequence) && normalized.sequence.length === 0)
          ) {
            delete normalized.sequence;
          }
          if (
            normalized.correctSequence === null ||
            (Array.isArray(normalized.correctSequence) &&
              normalized.correctSequence.length === 0)
          ) {
            delete normalized.correctSequence;
          }
          return normalized;
        })
      : value.rounds
  };
}
