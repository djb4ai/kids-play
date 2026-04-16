import crypto from "node:crypto";
import { ZodError } from "zod";
import {
  SKILLS,
  createMockCodexOutput,
  gameSessionSchema,
  getTemplateCatalogForPrompt,
  parseCodexGameOutput,
  parseGenerateGameRequest,
  type AdaptiveGenerationContext,
  type CodexGameOutput,
  type GameSession,
  type GameGenerationSource,
  type GenerateGameRequest,
  type Skill
} from "@kids-play/shared";
import { getCodexAppServerClient } from "./codex-app-server";
import { GameGenerationError } from "./errors";

export type GameGenerationClient = {
  generateGameConfig(
    input: GenerateGameRequest,
    context: AdaptiveGenerationContext
  ): Promise<unknown>;
};

export type LaunchMetadata = Pick<
  GameSession,
  | "gameId"
  | "templateType"
  | "runtimeUrl"
  | "launchMode"
  | "title"
  | "instructions"
  | "generationSource"
>;

export async function createGeneratedGameSession(
  rawInput: unknown,
  options: {
    adaptiveContext?: AdaptiveGenerationContext;
    client?: GameGenerationClient;
    generationSource?: GameGenerationSource;
    now?: Date;
    runtimeOrigin?: string;
  } = {}
): Promise<GameSession> {
  const input = parseGenerateGameRequest(rawInput);
  const adaptiveContext =
    options.adaptiveContext ?? createNewAdaptiveContext(input);
  const generationSource =
    options.generationSource ??
    (shouldUseMockGeneration(input.skill) ? "mock" : "codex_app_server");
  const client = options.client ?? getDefaultGenerationClient(input);
  const maxAttempts = generationSource === "codex_app_server" ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rawOutput = await client.generateGameConfig(input, adaptiveContext);
      const output = parseCodexGameOutput(rawOutput);

      if (output.skill !== input.skill) {
        throw new GameGenerationError("Generated skill did not match request.");
      }

      return buildTrustedSession(input, output, {
        generationSource,
        now: options.now,
        runtimeOrigin: options.runtimeOrigin
      });
    } catch (error) {
      lastError = error;

      if (!shouldRetryGeneration(error, attempt, maxAttempts)) {
        throw error;
      }

      console.warn(
        `[kids-play] generation attempt ${attempt} failed validation; retrying once`,
        error instanceof ZodError ? error.flatten() : error
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new GameGenerationError("Game generation failed.");
}

export function toLaunchMetadata(session: GameSession): LaunchMetadata {
  return {
    gameId: session.gameId,
    templateType: session.templateType,
    runtimeUrl: session.runtimeUrl,
    launchMode: session.launchMode,
    title: session.title,
    instructions: session.instructions,
    generationSource: session.generationSource
  };
}

export function shouldUseMockGeneration(
  skill: Skill,
  env: Record<string, string | undefined> = process.env
) {
  return env.KIDS_PLAY_CODEX_MODE === "mock" && !getLiveCodexSkills(env).has(skill);
}

function getDefaultGenerationClient(input: GenerateGameRequest): GameGenerationClient {
  if (shouldUseMockGeneration(input.skill)) {
    return {
      async generateGameConfig(input, context) {
        return createMockCodexOutput(input.skill, context);
      }
    };
  }

  return getCodexAppServerClient({
    cwd: process.cwd(),
    model: process.env.CODEX_MODEL ?? "gpt-5.4",
    templateCatalog: getTemplateCatalogForPrompt()
  });
}

function getLiveCodexSkills(env: Record<string, string | undefined>) {
  const rawValue = env.KIDS_PLAY_CODEX_LIVE_SKILLS ?? "";
  const requested = rawValue
    .split(",")
    .map((skill) => skill.trim().toLowerCase())
    .filter(Boolean);

  if (requested.includes("*") || requested.includes("all")) {
    return new Set<Skill>(SKILLS);
  }

  return new Set(
    requested.filter((skill): skill is Skill =>
      (SKILLS as readonly string[]).includes(skill)
    )
  );
}

function buildTrustedSession(
  input: GenerateGameRequest,
  output: CodexGameOutput,
  options: {
    generationSource: GameGenerationSource;
    now?: Date;
    runtimeOrigin?: string;
  }
) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const gameId = `game_${input.skill}_${suffix}`;
  const runtimeOrigin =
    options.runtimeOrigin ?? process.env.GAME_RUNTIME_ORIGIN ?? "http://127.0.0.1:3001";
  const runtimeUrl = `${runtimeOrigin.replace(/\/$/, "")}/game/${gameId}`;

  return gameSessionSchema.parse({
    ...output,
    gameId,
    childId: input.childId,
    ageGroup: input.ageGroup,
    difficultyLevel: input.difficultyLevel,
    generationSource: options.generationSource,
    runtimeUrl,
    launchMode: "embed",
    createdAt: (options.now ?? new Date()).toISOString()
  });
}

function createNewAdaptiveContext(
  input: GenerateGameRequest
): AdaptiveGenerationContext {
  return {
    childId: input.childId,
    skill: input.skill,
    targetDifficultyLevel: input.difficultyLevel,
    recentTrend: "new",
    lastSession: null,
    recommendation: null
  };
}

function shouldRetryGeneration(
  error: unknown,
  attempt: number,
  maxAttempts: number
) {
  return attempt < maxAttempts && error instanceof ZodError;
}
