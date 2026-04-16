import { describe, expect, it } from "vitest";
import {
  TEMPLATE_CATALOG,
  createMockCodexOutput,
  parseCodexGameOutput,
  type Skill
} from "@kids-play/shared";
import {
  createGeneratedGameSession,
  shouldUseMockGeneration
} from "../lib/generation";
import type { GameGenerationClient } from "../lib/generation";

const request = (skill: Skill) => ({
  childId: "demo_child",
  skill,
  ageGroup: "5-8" as const,
  difficultyLevel: 1 as const
});

const fixedNow = new Date("2026-04-16T06:30:00.000Z");

function clientReturning(output: unknown): GameGenerationClient {
  return {
    async generateGameConfig() {
      return output;
    }
  };
}

function createCreativeAttentionOutput() {
  return {
    skill: "attention" as const,
    templateType: "attention_codex_surprise" as const,
    title: "Moonlight Lookout",
    instructions: "Read the clue badge, then tap the matching helper.",
    items: [
      { id: "night_moon", label: "Moon", imageKey: "moon" as const, value: "night" },
      { id: "spark_star", label: "Star", imageKey: "star" as const, value: "spark" },
      { id: "day_sun", label: "Sun", imageKey: "sun" as const, value: "day" },
      { id: "soft_leaf", label: "Leaf", imageKey: "leaf" as const, value: "soft" }
    ],
    rounds: [
      {
        id: "lookout_night",
        prompt: "Tap the helper with the night badge.",
        choices: ["night_moon", "day_sun", "spark_star"],
        correctChoice: "night_moon",
        sequence: [],
        correctSequence: []
      },
      {
        id: "lookout_soft",
        prompt: "Tap the helper with the soft badge.",
        choices: ["spark_star", "soft_leaf", "day_sun"],
        correctChoice: "soft_leaf",
        sequence: [],
        correctSequence: []
      },
      {
        id: "lookout_spark",
        prompt: "Tap the helper with the spark badge.",
        choices: ["spark_star", "night_moon"],
        correctChoice: "spark_star",
        sequence: [],
        correctSequence: []
      }
    ],
    feedback: {
      correct: ["Nice spotting!"],
      tryAgain: ["Keep looking!"],
      complete: ["You stayed focused!"]
    }
  };
}

describe("createGeneratedGameSession", () => {
  it("lets selected skills use live Codex while mock mode stays on", () => {
    const env = {
      KIDS_PLAY_CODEX_MODE: "mock",
      KIDS_PLAY_CODEX_LIVE_SKILLS: "attention"
    };

    expect(shouldUseMockGeneration("reading", env)).toBe(true);
    expect(shouldUseMockGeneration("memory", env)).toBe(true);
    expect(shouldUseMockGeneration("attention", env)).toBe(false);
  });

  it("keeps every template in the catalog schema-valid", () => {
    for (const template of Object.values(TEMPLATE_CATALOG)) {
      expect(
        parseCodexGameOutput({
          skill: template.skill,
          templateType: template.templateType,
          title: template.title,
          instructions: template.instructions,
          items: template.items,
          rounds: template.rounds,
          feedback: {
            correct: ["Great job!"],
            tryAgain: ["Nice try!"],
            complete: ["Well done!"]
          }
        })
      ).toMatchObject({
        skill: template.skill,
        templateType: template.templateType
      });
    }
  });

  it.each(["reading", "memory", "attention"] as const)(
    "accepts valid %s configs and computes trusted launch metadata",
    async (skill) => {
      const session = await createGeneratedGameSession(request(skill), {
        client: clientReturning(createMockCodexOutput(skill)),
        generationSource: "mock",
        now: fixedNow,
        runtimeOrigin: "http://127.0.0.1:3001"
      });

      expect(session.skill).toBe(skill);
      expect(session.childId).toBe("demo_child");
      expect(session.difficultyLevel).toBe(1);
      expect(session.gameId).toMatch(new RegExp(`^game_${skill}_[a-f0-9]{8}$`));
      expect(session.runtimeUrl).toBe(
        `http://127.0.0.1:3001/game/${session.gameId}`
      );
      expect(session.launchMode).toBe("embed");
      expect(session.generationSource).toBe("mock");
      expect(session.createdAt).toBe("2026-04-16T06:30:00.000Z");
    }
  );

  it("accepts freeform live attention configs that do not use catalog templates", async () => {
    const session = await createGeneratedGameSession(request("attention"), {
      client: clientReturning(createCreativeAttentionOutput()),
      generationSource: "codex_app_server",
      now: fixedNow,
      runtimeOrigin: "http://127.0.0.1:3001"
    });

    expect(session.generationSource).toBe("codex_app_server");
    expect(session.templateType).toBe("attention_codex_surprise");
    expect(session.title).toBe("Moonlight Lookout");
    expect(session.rounds[0]?.correctChoice).toBe("night_moon");
    expect(session.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["night_moon", "spark_star", "day_sun", "soft_leaf"])
    );
  });

  it("rejects invalid skill input", async () => {
    await expect(
      createGeneratedGameSession(
        {
          childId: "demo_child",
          skill: "math",
          ageGroup: "5-8",
          difficultyLevel: 1
        },
        { client: clientReturning(createMockCodexOutput("reading")) }
      )
    ).rejects.toThrow();
  });

  it("rejects unknown template types", async () => {
    await expect(
      createGeneratedGameSession(request("reading"), {
        client: clientReturning({
          ...createMockCodexOutput("reading"),
          templateType: "surprise_new_game"
        })
      })
    ).rejects.toThrow();
  });

  it("rejects runtime fields supplied by Codex", async () => {
    await expect(
      createGeneratedGameSession(request("reading"), {
        client: clientReturning({
          ...createMockCodexOutput("reading"),
          runtimeUrl: "http://localhost:9999/game/raw"
        })
      })
    ).rejects.toThrow();
  });

  it("rejects long or negative feedback", async () => {
    const output = createMockCodexOutput("attention");
    output.feedback.tryAgain = ["Wrong answer, that was a bad mistake."];

    await expect(
      createGeneratedGameSession(request("attention"), {
        client: clientReturning(output)
      })
    ).rejects.toThrow();
  });

  it("rejects malformed rounds", async () => {
    const output = createMockCodexOutput("memory");
    output.rounds[0] = {
      ...output.rounds[0],
      correctSequence: ["moon", "sun"]
    };

    await expect(
      createGeneratedGameSession(request("memory"), {
        client: clientReturning(output)
      })
    ).rejects.toThrow();
  });
});
