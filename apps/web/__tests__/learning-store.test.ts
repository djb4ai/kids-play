import { afterEach, describe, expect, it } from "vitest";
import {
  createMockCodexOutput,
  gameSessionSchema,
  type GameSession,
  type SaveSessionRequest,
  type Skill
} from "@kids-play/shared";
import { LearningStore, DEMO_CHILD_ID } from "../lib/learning-store";

let stores: LearningStore[] = [];

afterEach(() => {
  for (const store of stores) {
    store.close();
  }
  stores = [];
});

function createStore() {
  const store = new LearningStore(":memory:");
  stores.push(store);
  return store;
}

function createSession(skill: Skill, gameId = `game_${skill}_test`): GameSession {
  return gameSessionSchema.parse({
    ...createMockCodexOutput(skill),
    gameId,
    childId: DEMO_CHILD_ID,
    ageGroup: "5-8",
    difficultyLevel: 1,
    runtimeUrl: `http://127.0.0.1:3001/game/${gameId}`,
    launchMode: "embed",
    createdAt: "2026-04-16T06:30:00.000Z"
  });
}

function baseSaveRequest(
  gameId: string,
  events: SaveSessionRequest["events"]
): SaveSessionRequest {
  return {
    gameId,
    childId: DEMO_CHILD_ID,
    startedAt: "2026-04-16T06:31:00.000Z",
    endedAt: "2026-04-16T06:32:00.000Z",
    summary: {
      correct: 3,
      total: 3
    },
    events
  };
}

describe("LearningStore", () => {
  it("stores a weak reading session and feeds a deterministic mock adaptation", async () => {
    const store = createStore();
    const session = createSession("reading");
    store.saveGeneratedGameSession(session);

    const result = await store.saveCompletedSession(
      baseSaveRequest(session.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "read_apple",
          selectedAnswer: "ball",
          correctAnswer: "apple",
          isCorrect: false,
          responseTimeMs: 3400,
          timestamp: "2026-04-16T06:31:10.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "read_apple",
          selectedAnswer: "apple",
          correctAnswer: "apple",
          isCorrect: true,
          responseTimeMs: 4200,
          timestamp: "2026-04-16T06:31:14.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 1,
          questionOrItem: "read_book",
          selectedAnswer: "fish",
          correctAnswer: "book",
          isCorrect: false,
          responseTimeMs: 3200,
          timestamp: "2026-04-16T06:31:20.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 1,
          questionOrItem: "read_book",
          selectedAnswer: "book",
          correctAnswer: "book",
          isCorrect: true,
          responseTimeMs: 3900,
          timestamp: "2026-04-16T06:31:24.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 2,
          questionOrItem: "read_cat",
          selectedAnswer: "ball",
          correctAnswer: "cat",
          isCorrect: false,
          responseTimeMs: 3100,
          timestamp: "2026-04-16T06:31:30.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 2,
          questionOrItem: "read_cat",
          selectedAnswer: "cat",
          correctAnswer: "cat",
          isCorrect: true,
          responseTimeMs: 3900,
          timestamp: "2026-04-16T06:31:34.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ])
    );

    expect(result.recommendation?.nextFocus).toContain("repeat");
    expect(result.recommendation?.suggestedDifficultyLevel).toBe(1);

    const context = store.getAdaptiveContext(DEMO_CHILD_ID, "reading");
    expect(context.recentTrend).toBe("needs_support");
    expect(context.lastSession?.accuracy).toBe(0.5);
    expect(context.lastSession?.commonMistakes).toEqual(["apple", "book", "cat"]);

    const adapted = createMockCodexOutput("reading", context);
    expect(adapted.title).toBe("Reading Gentle Repeat");
    expect(adapted.rounds).toHaveLength(3);
    expect(adapted.rounds[0].correctChoice).toBe("apple");
    expect(adapted.rounds[0].choices).toHaveLength(2);
  });

  it("raises memory difficulty after a strong fast session", async () => {
    const store = createStore();
    const session = createSession("memory");
    store.saveGeneratedGameSession(session);

    const result = await store.saveCompletedSession(
      baseSaveRequest(session.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "mem_sun_leaf",
          selectedAnswer: "sun",
          correctAnswer: "sun",
          isCorrect: true,
          responseTimeMs: 900,
          timestamp: "2026-04-16T06:31:05.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 1,
          questionOrItem: "mem_star_moon",
          selectedAnswer: "star",
          correctAnswer: "star",
          isCorrect: true,
          responseTimeMs: 1000,
          timestamp: "2026-04-16T06:31:15.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 2,
          questionOrItem: "mem_leaf_tree_sun",
          selectedAnswer: "leaf",
          correctAnswer: "leaf",
          isCorrect: true,
          responseTimeMs: 1100,
          timestamp: "2026-04-16T06:31:25.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ])
    );

    expect(result.recommendation?.suggestedDifficultyLevel).toBe(2);
    expect(store.getLearnerProfile(DEMO_CHILD_ID).skills.memory.level).toBe(2);

    const context = store.getAdaptiveContext(DEMO_CHILD_ID, "memory");
    const adapted = createMockCodexOutput("memory", context);
    expect(adapted.title).toBe("Memory Next Step");
    expect(adapted.rounds[0].sequence).toHaveLength(3);
  });

  it("returns a debug snapshot with profile, sessions, and recommendations", async () => {
    const store = createStore();
    const session = createSession("attention");
    store.saveGeneratedGameSession(session);
    await store.saveCompletedSession(
      baseSaveRequest(session.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "att_star",
          selectedAnswer: "star",
          correctAnswer: "star",
          isCorrect: true,
          responseTimeMs: 1000,
          timestamp: "2026-04-16T06:31:05.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ])
    );

    const snapshot = store.getDebugSnapshot(DEMO_CHILD_ID);
    expect(snapshot.profile.childId).toBe(DEMO_CHILD_ID);
    expect(snapshot.recentSessions).toHaveLength(1);
    expect(snapshot.recommendations).toHaveLength(1);
  });

  it("builds an empty parent dashboard for a child with no sessions", () => {
    const store = createStore();

    const dashboard = store.getParentDashboard(DEMO_CHILD_ID);

    expect(dashboard.totalSessions).toBe(0);
    expect(dashboard.lastPlayedAt).toBeNull();
    expect(dashboard.recentSessions).toHaveLength(0);
    expect(dashboard.skills.every((skill) => skill.sessionsPlayed === 0)).toBe(true);
  });

  it("builds parent summaries, session detail, and skill detail from stored sessions", async () => {
    const store = createStore();

    const reading = createSession("reading", "game_reading_parent");
    const memory = createSession("memory", "game_memory_parent");
    store.saveGeneratedGameSession(reading);
    store.saveGeneratedGameSession(memory);

    await store.saveCompletedSession(
      baseSaveRequest(reading.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "read_apple",
          selectedAnswer: "apple",
          correctAnswer: "apple",
          isCorrect: true,
          responseTimeMs: 1100,
          timestamp: "2026-04-16T06:31:05.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 1,
          questionOrItem: "read_book",
          selectedAnswer: "book",
          correctAnswer: "book",
          isCorrect: true,
          responseTimeMs: 1000,
          timestamp: "2026-04-16T06:31:15.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 2,
          questionOrItem: "read_cat",
          selectedAnswer: "cat",
          correctAnswer: "cat",
          isCorrect: true,
          responseTimeMs: 900,
          timestamp: "2026-04-16T06:31:25.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ])
    );

    const memoryResult = await store.saveCompletedSession(
      baseSaveRequest(memory.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:33:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "mem_sun_leaf",
          selectedAnswer: "moon",
          correctAnswer: "sun",
          isCorrect: false,
          responseTimeMs: 2900,
          timestamp: "2026-04-16T06:33:05.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "mem_sun_leaf",
          selectedAnswer: "sun",
          correctAnswer: "sun",
          isCorrect: true,
          responseTimeMs: 1800,
          timestamp: "2026-04-16T06:33:08.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:34:00.000Z" }
      ])
    );

    const dashboard = store.getParentDashboard(DEMO_CHILD_ID);
    expect(dashboard.totalSessions).toBe(2);
    expect(dashboard.recentSessions).toHaveLength(2);
    expect(dashboard.skills.find((skill) => skill.skill === "reading")?.trend).toBe("steady");
    expect(dashboard.skills.find((skill) => skill.skill === "memory")?.trend).toBe(
      "needs_support"
    );

    const sessions = store.getParentSessions(DEMO_CHILD_ID);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.skill).toBe("memory");

    const detail = store.getParentSessionDetail(DEMO_CHILD_ID, memoryResult.sessionId);
    expect(detail?.sessionId).toBe(memoryResult.sessionId);
    expect(detail?.nextFocus).toContain("repeat");
    expect(detail?.supportAreas.length).toBeGreaterThan(0);

    const skillDetail = store.getParentSkillDetail(DEMO_CHILD_ID, "memory");
    expect(skillDetail.sessionsPlayed).toBe(1);
    expect(skillDetail.trend).toBe("needs_support");
    expect(skillDetail.recentSessions[0]?.sessionId).toBe(memoryResult.sessionId);
  });

  it("tracks improving skill trends across multiple sessions", async () => {
    const store = createStore();
    const childId = "trend_child";

    const weak = createSession("reading", "game_reading_trend_1");
    const stronger = createSession("reading", "game_reading_trend_2");
    store.saveGeneratedGameSession({ ...weak, childId });
    store.saveGeneratedGameSession({ ...stronger, childId });

    await store.saveCompletedSession({
      ...baseSaveRequest(weak.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "read_apple",
          selectedAnswer: "ball",
          correctAnswer: "apple",
          isCorrect: false,
          responseTimeMs: 3200,
          timestamp: "2026-04-16T06:31:05.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ]),
      childId
    });

    await store.saveCompletedSession({
      ...baseSaveRequest(stronger.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:41:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "read_apple",
          selectedAnswer: "apple",
          correctAnswer: "apple",
          isCorrect: true,
          responseTimeMs: 1200,
          timestamp: "2026-04-16T06:41:05.000Z"
        },
        {
          eventType: "answer_submitted",
          roundIndex: 1,
          questionOrItem: "read_book",
          selectedAnswer: "book",
          correctAnswer: "book",
          isCorrect: true,
          responseTimeMs: 1000,
          timestamp: "2026-04-16T06:41:10.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:42:00.000Z" }
      ]),
      childId,
      summary: { correct: 2, total: 2 }
    });

    expect(store.getParentSkillDetail(childId, "reading").trend).toBe("improving");
  });

  it("keeps session detail scoped to the requested child", async () => {
    const store = createStore();
    const session = createSession("attention", "game_attention_private");
    const otherChildId = "other_child";
    store.saveGeneratedGameSession({ ...session, childId: otherChildId });

    const result = await store.saveCompletedSession({
      ...baseSaveRequest(session.gameId, [
        { eventType: "game_started", timestamp: "2026-04-16T06:31:00.000Z" },
        {
          eventType: "answer_submitted",
          roundIndex: 0,
          questionOrItem: "att_star",
          selectedAnswer: "star",
          correctAnswer: "star",
          isCorrect: true,
          responseTimeMs: 1000,
          timestamp: "2026-04-16T06:31:05.000Z"
        },
        { eventType: "game_completed", timestamp: "2026-04-16T06:32:00.000Z" }
      ]),
      childId: otherChildId
    });

    expect(store.getParentSessionDetail(DEMO_CHILD_ID, result.sessionId)).toBeNull();
    expect(store.getParentSessionDetail(otherChildId, result.sessionId)?.sessionId).toBe(
      result.sessionId
    );
  });
});
