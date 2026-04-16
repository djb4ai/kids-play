export const SKILLS = ["reading", "memory", "attention"] as const;

export type Skill = (typeof SKILLS)[number];

export const DIFFICULTIES = ["beginner"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const GENERATION_SOURCES = ["mock", "codex_app_server"] as const;

export type GameGenerationSource = (typeof GENERATION_SOURCES)[number];

export const DIFFICULTY_LEVELS = [1, 2, 3] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const AGE_GROUPS = ["5-8"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export const TEMPLATE_TYPES = [
  "reading_word_match",
  "reading_picture_clue",
  "memory_sequence",
  "memory_shape_path",
  "attention_target_tap",
  "attention_shape_scan",
  "attention_codex_surprise"
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
  childId: string;
  skill: Skill;
  ageGroup: AgeGroup;
  difficultyLevel: DifficultyLevel;
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
  childId: string;
  ageGroup: AgeGroup;
  difficultyLevel: DifficultyLevel;
  generationSource: GameGenerationSource;
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
  | { type: "kids-play:game-event"; gameId: string; event: GameplayEvent }
  | {
      type: "kids-play:complete";
      gameId: string;
      summary: { correct: number; total: number };
    }
  | { type: "kids-play:go-home"; gameId: string };

export const GAMEPLAY_EVENT_TYPES = [
  "game_started",
  "round_started",
  "prompt_shown",
  "answer_submitted",
  "answer_correct",
  "answer_incorrect",
  "hint_used",
  "round_completed",
  "game_completed"
] as const;

export type GameplayEventType = (typeof GAMEPLAY_EVENT_TYPES)[number];

export type GameplayEvent = {
  eventType: GameplayEventType;
  roundIndex?: number;
  questionOrItem?: string;
  selectedAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type SaveSessionRequest = {
  gameId: string;
  childId: string;
  startedAt: string;
  endedAt: string;
  summary: {
    correct: number;
    total: number;
  };
  events: GameplayEvent[];
};

export type SkillProgress = {
  level: DifficultyLevel;
  strengths: string[];
  supportAreas: string[];
  lastAccuracy: number | null;
  lastAvgResponseTimeMs: number | null;
  recommendedFocus: string;
};

export type LearnerProfile = {
  childId: string;
  displayName: string;
  ageGroup: AgeGroup;
  skills: Record<Skill, SkillProgress>;
  createdAt: string;
  updatedAt: string;
};

export type Recommendation = {
  id: string;
  childId: string;
  skill: Skill;
  summary: string;
  nextFocus: string;
  suggestedDifficultyLevel: DifficultyLevel;
  createdAt: string;
};

export type AdaptiveGenerationContext = {
  childId: string;
  skill: Skill;
  targetDifficultyLevel: DifficultyLevel;
  recentTrend: "new" | "needs_support" | "steady" | "ready_for_more";
  lastSession: {
    accuracy: number;
    commonMistakes: string[];
    averageResponseTimeMs: number | null;
  } | null;
  recommendation: {
    focus: string;
    summary: string;
    difficultyLevel: DifficultyLevel;
  } | null;
};

export type ParentTrend = "new" | "steady" | "improving" | "needs_support";

export type ParentSkillSummary = {
  skill: Skill;
  label: string;
  sessionsPlayed: number;
  latestAccuracy: number | null;
  trend: ParentTrend;
  strengths: string[];
  supportAreas: string[];
  recommendedFocus: string;
};

export type ParentSessionListItem = {
  sessionId: string;
  gameId: string;
  skill: Skill;
  skillLabel: string;
  templateType: TemplateType;
  score: number;
  totalTasks: number;
  accuracy: number;
  averageResponseTimeMs: number | null;
  durationMs: number;
  interpretation: string;
  startedAt: string;
  endedAt: string;
};

export type ParentDashboard = {
  childId: string;
  displayName: string;
  ageGroup: AgeGroup;
  totalSessions: number;
  lastPlayedAt: string | null;
  currentFocus: string;
  summary: string;
  strengths: string[];
  supportAreas: string[];
  skills: ParentSkillSummary[];
  recentSessions: ParentSessionListItem[];
};

export type ParentSessionDetail = ParentSessionListItem & {
  childId: string;
  difficultyLevel: DifficultyLevel;
  correctAnswers: number;
  incorrectAnswers: number;
  retries: number;
  hintsUsed: number;
  recommendationSummary: string | null;
  nextFocus: string | null;
  strengths: string[];
  supportAreas: string[];
  commonMistakes: string[];
};

export type ParentSkillDetail = {
  childId: string;
  displayName: string;
  ageGroup: AgeGroup;
  skill: Skill;
  skillLabel: string;
  trend: ParentTrend;
  summary: string;
  sessionsPlayed: number;
  latestAccuracy: number | null;
  averageAccuracy: number | null;
  latestResponseTimeMs: number | null;
  strengths: string[];
  supportAreas: string[];
  nextFocus: string;
  recentSessions: ParentSessionListItem[];
};
