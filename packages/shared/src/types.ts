export const SKILLS = ["reading", "memory", "attention"] as const;

export type Skill = (typeof SKILLS)[number];

export const DIFFICULTIES = ["beginner"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const AGE_GROUPS = ["5-8"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export const TEMPLATE_TYPES = [
  "reading_word_match",
  "reading_picture_clue",
  "memory_sequence",
  "memory_shape_path",
  "attention_target_tap",
  "attention_shape_scan"
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const IMAGE_KEYS = [
  "apple",
  "ball",
  "book",
  "cat",
  "circle",
  "fish",
  "leaf",
  "moon",
  "square",
  "star",
  "sun",
  "tree"
] as const;

export type ImageKey = (typeof IMAGE_KEYS)[number];

export type GenerateGameRequest = {
  skill: Skill;
  ageGroup: AgeGroup;
  difficulty: Difficulty;
};

export type GameItem = {
  id: string;
  label: string;
  imageKey: ImageKey;
  value?: string;
};

export type GameRound = {
  id: string;
  prompt: string;
  choices: string[];
  correctChoice?: string;
  sequence?: string[];
  correctSequence?: string[];
};

export type FeedbackSet = {
  correct: string[];
  tryAgain: string[];
  complete: string[];
};

export type CodexGameOutput = {
  skill: Skill;
  templateType: TemplateType;
  title: string;
  instructions: string;
  items: GameItem[];
  rounds: GameRound[];
  feedback: FeedbackSet;
};

export type GameSession = CodexGameOutput & {
  gameId: string;
  ageGroup: AgeGroup;
  difficulty: Difficulty;
  runtimeUrl: string;
  launchMode: "embed";
  createdAt: string;
};

export type TemplateDefinition = {
  templateType: TemplateType;
  skill: Skill;
  title: string;
  instructions: string;
  description: string;
  items: GameItem[];
  rounds: GameRound[];
};

export type GameRuntimeEvent =
  | { type: "kids-play:game-started"; gameId: string }
  | { type: "kids-play:feedback"; gameId: string; message: string }
  | {
      type: "kids-play:complete";
      gameId: string;
      summary: { correct: number; total: number };
    }
  | { type: "kids-play:go-home"; gameId: string };
