import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  gameSessionSchema,
  type AdaptiveGenerationContext,
  type DifficultyLevel,
  type GameSession,
  type LearnerProfile,
  type ParentDashboard,
  type ParentSessionDetail,
  type ParentSessionListItem,
  type ParentSkillDetail,
  type ParentSkillSummary,
  type ParentTrend,
  type Recommendation,
  type SaveSessionRequest,
  type Skill,
  type SkillProgress,
  type TemplateType
} from "@kids-play/shared";
import {
  buildAdaptiveContext,
  buildRecommendation,
  calculateSessionMetrics,
  getSkillStrengths,
  getSkillSupportAreas,
  type CompletedSessionMetrics
} from "./adaptation";
import {
  applyInsightToRecommendation,
  generateOpenAIProgressInsight
} from "./openai-insights";

export const DEMO_CHILD_ID = "demo_child";

type ChildRow = {
  id: string;
  display_name: string;
  age_group: "5-8";
  reading_level: number;
  memory_level: number;
  attention_level: number;
  created_at: string;
  updated_at: string;
};

type GameConfigRow = {
  config_json: string;
};

type SessionRow = {
  id: string;
  game_id: string;
  child_id: string;
  skill: Skill;
  template: string;
  difficulty_level: number;
  score: number;
  total_tasks: number;
  correct_answers: number;
  incorrect_answers: number;
  retries: number;
  hints_used: number;
  accuracy: number;
  average_response_time_ms: number | null;
  duration_ms: number;
  completed: number;
  started_at: string;
  ended_at: string;
  created_at: string;
};

type RecommendationRow = {
  id: string;
  child_id: string;
  skill: Skill;
  summary: string;
  next_focus: string;
  suggested_difficulty_level: number;
  created_at: string;
};

type MistakeRow = {
  item: string | null;
  count: number;
};

declare global {
  var __kidsPlayLearningStore: LearningStore | undefined;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const skillLevelColumns: Record<Skill, keyof ChildRow> = {
  reading: "reading_level",
  memory: "memory_level",
  attention: "attention_level"
};

export function getLearningStore() {
  globalThis.__kidsPlayLearningStore ??= new LearningStore(resolveDbPath());
  return globalThis.__kidsPlayLearningStore;
}

export function resetLearningStoreForTest() {
  globalThis.__kidsPlayLearningStore?.close();
  globalThis.__kidsPlayLearningStore = undefined;
}

export class LearningStore {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  ensureDemoChild(now = new Date()) {
    return this.ensureChild(DEMO_CHILD_ID, now);
  }

  ensureChild(childId: string, now = new Date()) {
    const timestamp = now.toISOString();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO children (
          id,
          display_name,
          age_group,
          preferred_skills,
          reading_level,
          memory_level,
          attention_level,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        childId,
        childId === DEMO_CHILD_ID ? "Demo Learner" : childId,
        "5-8",
        JSON.stringify(["reading", "memory", "attention"]),
        1,
        1,
        1,
        timestamp,
        timestamp
      );

    return this.getChild(childId);
  }

  saveGeneratedGameSession(session: GameSession) {
    this.ensureChild(session.childId);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO game_configs (
          game_id,
          child_id,
          skill,
          template_type,
          config_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.gameId,
        session.childId,
        session.skill,
        session.templateType,
        JSON.stringify(session),
        session.createdAt
      );
  }

  getGeneratedGameSession(gameId: string) {
    const row = this.db
      .prepare("SELECT config_json FROM game_configs WHERE game_id = ?")
      .get(gameId) as GameConfigRow | undefined;

    if (!row) {
      return null;
    }

    return gameSessionSchema.parse(JSON.parse(row.config_json));
  }

  async saveCompletedSession(request: SaveSessionRequest, now = new Date()) {
    const existing = this.getSessionByGameId(request.gameId);
    if (existing) {
      return {
        sessionId: existing.id,
        recommendation: this.getLatestRecommendation(request.childId, existing.skill)
      };
    }

    const game = this.getGeneratedGameSession(request.gameId);
    if (!game) {
      throw new Error("Game session was not found.");
    }
    if (game.childId !== request.childId) {
      throw new Error("Session child did not match the generated game.");
    }

    const child = this.ensureChild(request.childId, now);
    const currentLevel = getDifficultyLevel(child[skillLevelColumns[game.skill]]);
    const metrics = calculateSessionMetrics(game, request);
    const baseRecommendation = buildRecommendation({
      childId: request.childId,
      skill: game.skill,
      currentLevel,
      metrics,
      now
    });
    const recommendation = applyInsightToRecommendation(
      baseRecommendation,
      await generateOpenAIProgressInsight({
        skill: game.skill,
        currentRecommendation: baseRecommendation,
        metrics
      })
    );
    const sessionId = `session_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const createdAt = now.toISOString();

    this.db.exec("BEGIN");
    try {
      this.insertCompletedSession(sessionId, game, request, metrics, createdAt);
      this.insertEvents(sessionId, game, request);
      this.insertRecommendation(recommendation);
      this.updateSkillLevel(
        request.childId,
        game.skill,
        recommendation.suggestedDifficultyLevel,
        createdAt
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return { sessionId, recommendation };
  }

  getAdaptiveContext(childId: string, skill: Skill): AdaptiveGenerationContext {
    const child = this.ensureChild(childId);
    const recommendation = this.getLatestRecommendation(childId, skill);
    const latestSession = this.getLatestSession(childId, skill);
    const targetDifficultyLevel =
      recommendation?.suggestedDifficultyLevel ??
      getDifficultyLevel(child[skillLevelColumns[skill]]);

    return buildAdaptiveContext({
      childId,
      skill,
      targetDifficultyLevel,
      lastSession: latestSession
        ? {
            accuracy: latestSession.accuracy,
            averageResponseTimeMs: latestSession.average_response_time_ms,
            commonMistakes: this.getCommonMistakes(latestSession.id)
          }
        : null,
      recommendation
    });
  }

  getLearnerProfile(childId: string): LearnerProfile {
    const child = this.ensureChild(childId);

    return {
      childId: child.id,
      displayName: child.display_name,
      ageGroup: child.age_group,
      skills: {
        reading: this.getSkillProgress(child, "reading"),
        memory: this.getSkillProgress(child, "memory"),
        attention: this.getSkillProgress(child, "attention")
      },
      createdAt: child.created_at,
      updatedAt: child.updated_at
    };
  }

  getDebugSnapshot(childId: string) {
    return {
      profile: this.getLearnerProfile(childId),
      recentSessions: this.getRecentSessions(childId, 8),
      recommendations: this.getRecentRecommendations(childId, 8)
    };
  }

  getParentDashboard(childId: string): ParentDashboard {
    const child = this.ensureChild(childId);
    const allSessions = this.getSessionRowsForChild(childId);
    const recentSessions = allSessions.slice(0, 5).map((row) => this.toParentSessionListItem(row));
    const skills = (["reading", "memory", "attention"] as const).map((skill) =>
      this.getParentSkillSummary(child, skill)
    );
    const strengths = uniqueStrings(skills.flatMap((skill) => skill.strengths)).slice(0, 3);
    const supportAreas = uniqueStrings(skills.flatMap((skill) => skill.supportAreas)).slice(0, 3);
    const latestRecommendation = this.getLatestRecommendationAcrossSkills(childId);

    return {
      childId: child.id,
      displayName: child.display_name,
      ageGroup: child.age_group,
      totalSessions: allSessions.length,
      lastPlayedAt: allSessions[0]?.ended_at ?? null,
      currentFocus: latestRecommendation?.nextFocus ?? "Start with a short warm-up.",
      summary: buildDashboardSummary(child.display_name, allSessions.length, strengths, supportAreas),
      strengths,
      supportAreas,
      skills,
      recentSessions
    };
  }

  getParentSessions(childId: string, limit?: number): ParentSessionListItem[] {
    this.ensureChild(childId);
    const rows = this.getSessionRowsForChild(childId);
    const scopedRows = typeof limit === "number" ? rows.slice(0, limit) : rows;
    return scopedRows.map((row) => this.toParentSessionListItem(row));
  }

  getParentSessionDetail(childId: string, sessionId: string): ParentSessionDetail | null {
    this.ensureChild(childId);
    const row = this.getSessionById(childId, sessionId);
    if (!row) {
      return null;
    }

    const commonMistakes = this.getCommonMistakes(row.id);
    const metrics = sessionRowToMetrics(row, commonMistakes);
    const recommendation = this.getLatestRecommendationBefore(row.child_id, row.skill, row.created_at);
    const summary = this.toParentSessionListItem(row);

    return {
      ...summary,
      childId: row.child_id,
      difficultyLevel: getDifficultyLevel(row.difficulty_level),
      correctAnswers: row.correct_answers,
      incorrectAnswers: row.incorrect_answers,
      retries: row.retries,
      hintsUsed: row.hints_used,
      recommendationSummary: recommendation?.summary ?? null,
      nextFocus: recommendation?.nextFocus ?? null,
      strengths: getSkillStrengths(row.skill, metrics),
      supportAreas: getSkillSupportAreas(row.skill, metrics),
      commonMistakes
    };
  }

  getParentSkillDetail(childId: string, skill: Skill): ParentSkillDetail {
    const child = this.ensureChild(childId);
    const rows = this.getSessionRowsForSkill(childId, skill);
    const skillSummary = this.getParentSkillSummary(child, skill);

    return {
      childId: child.id,
      displayName: child.display_name,
      ageGroup: child.age_group,
      skill,
      skillLabel: toSkillLabel(skill),
      trend: skillSummary.trend,
      summary: buildSkillSummary(skillSummary),
      sessionsPlayed: rows.length,
      latestAccuracy: skillSummary.latestAccuracy,
      averageAccuracy:
        rows.length > 0
          ? Math.round(
              (rows.reduce((total, row) => total + row.accuracy, 0) / rows.length) * 100
            ) / 100
          : null,
      latestResponseTimeMs: rows[0]?.average_response_time_ms ?? null,
      strengths: skillSummary.strengths,
      supportAreas: skillSummary.supportAreas,
      nextFocus: skillSummary.recommendedFocus,
      recentSessions: rows.slice(0, 6).map((row) => this.toParentSessionListItem(row))
    };
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        age_group TEXT NOT NULL,
        preferred_skills TEXT NOT NULL,
        reading_level INTEGER NOT NULL,
        memory_level INTEGER NOT NULL,
        attention_level INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_configs (
        game_id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        template_type TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES children(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL UNIQUE,
        child_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        template TEXT NOT NULL,
        difficulty_level INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total_tasks INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        incorrect_answers INTEGER NOT NULL,
        retries INTEGER NOT NULL,
        hints_used INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        average_response_time_ms INTEGER,
        duration_ms INTEGER NOT NULL,
        completed INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES children(id),
        FOREIGN KEY (game_id) REFERENCES game_configs(game_id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        round_index INTEGER,
        question_or_item TEXT,
        selected_answer TEXT,
        correct_answer TEXT,
        is_correct INTEGER,
        response_time_ms INTEGER,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (child_id) REFERENCES children(id),
        FOREIGN KEY (game_id) REFERENCES game_configs(game_id)
      );

      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        summary TEXT NOT NULL,
        next_focus TEXT NOT NULL,
        suggested_difficulty_level INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES children(id)
      );

      CREATE INDEX IF NOT EXISTS sessions_child_skill_created_idx
        ON sessions(child_id, skill, created_at DESC);
      CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id);
      CREATE INDEX IF NOT EXISTS recommendations_child_skill_created_idx
        ON recommendations(child_id, skill, created_at DESC);
    `);
  }

  private getChild(childId: string) {
    const child = this.db
      .prepare("SELECT * FROM children WHERE id = ?")
      .get(childId) as ChildRow | undefined;

    if (!child) {
      throw new Error("Child profile was not created.");
    }

    return child;
  }

  private insertCompletedSession(
    sessionId: string,
    game: GameSession,
    request: SaveSessionRequest,
    metrics: CompletedSessionMetrics,
    createdAt: string
  ) {
    this.db
      .prepare(
        `INSERT INTO sessions (
          id,
          game_id,
          child_id,
          skill,
          template,
          difficulty_level,
          score,
          total_tasks,
          correct_answers,
          incorrect_answers,
          retries,
          hints_used,
          accuracy,
          average_response_time_ms,
          duration_ms,
          completed,
          started_at,
          ended_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sessionId,
        request.gameId,
        request.childId,
        game.skill,
        game.templateType,
        game.difficultyLevel,
        metrics.score,
        metrics.totalTasks,
        metrics.correctAnswers,
        metrics.incorrectAnswers,
        metrics.retries,
        metrics.hintsUsed,
        metrics.accuracy,
        metrics.averageResponseTimeMs,
        metrics.durationMs,
        1,
        request.startedAt,
        request.endedAt,
        createdAt
      );
  }

  private insertEvents(
    sessionId: string,
    game: GameSession,
    request: SaveSessionRequest
  ) {
    const statement = this.db.prepare(
      `INSERT INTO events (
        id,
        session_id,
        child_id,
        game_id,
        event_type,
        round_index,
        question_or_item,
        selected_answer,
        correct_answer,
        is_correct,
        response_time_ms,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const event of request.events) {
      statement.run(
        `event_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
        sessionId,
        request.childId,
        game.gameId,
        event.eventType,
        event.roundIndex ?? null,
        event.questionOrItem ?? null,
        event.selectedAnswer ?? null,
        event.correctAnswer ?? null,
        typeof event.isCorrect === "boolean" ? Number(event.isCorrect) : null,
        event.responseTimeMs ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp
      );
    }
  }

  private insertRecommendation(recommendation: Recommendation) {
    this.db
      .prepare(
        `INSERT INTO recommendations (
          id,
          child_id,
          skill,
          summary,
          next_focus,
          suggested_difficulty_level,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        recommendation.id,
        recommendation.childId,
        recommendation.skill,
        recommendation.summary,
        recommendation.nextFocus,
        recommendation.suggestedDifficultyLevel,
        recommendation.createdAt
      );
  }

  private updateSkillLevel(
    childId: string,
    skill: Skill,
    level: DifficultyLevel,
    updatedAt: string
  ) {
    const column = skillLevelColumns[skill];
    this.db
      .prepare(`UPDATE children SET ${column} = ?, updated_at = ? WHERE id = ?`)
      .run(level, updatedAt, childId);
  }

  private getSessionByGameId(gameId: string) {
    return this.db
      .prepare("SELECT * FROM sessions WHERE game_id = ?")
      .get(gameId) as SessionRow | undefined;
  }

  private getSessionById(childId: string, sessionId: string) {
    return this.db
      .prepare("SELECT * FROM sessions WHERE child_id = ? AND id = ?")
      .get(childId, sessionId) as SessionRow | undefined;
  }

  private getSessionRowsForChild(childId: string) {
    return this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE child_id = ?
         ORDER BY created_at DESC`
      )
      .all(childId) as SessionRow[];
  }

  private getSessionRowsForSkill(childId: string, skill: Skill) {
    return this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE child_id = ? AND skill = ?
         ORDER BY created_at DESC`
      )
      .all(childId, skill) as SessionRow[];
  }

  private getLatestSession(childId: string, skill: Skill) {
    return this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE child_id = ? AND skill = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(childId, skill) as SessionRow | undefined;
  }

  private getLatestRecommendation(childId: string, skill: Skill) {
    const row = this.db
      .prepare(
        `SELECT * FROM recommendations
         WHERE child_id = ? AND skill = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(childId, skill) as RecommendationRow | undefined;

    return row ? toRecommendation(row) : null;
  }

  private getLatestRecommendationAcrossSkills(childId: string) {
    const row = this.db
      .prepare(
        `SELECT * FROM recommendations
         WHERE child_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(childId) as RecommendationRow | undefined;

    return row ? toRecommendation(row) : null;
  }

  private getLatestRecommendationBefore(
    childId: string,
    skill: Skill,
    createdAt: string
  ) {
    const row = this.db
      .prepare(
        `SELECT * FROM recommendations
         WHERE child_id = ? AND skill = ? AND created_at >= ?
         ORDER BY created_at ASC
         LIMIT 1`
      )
      .get(childId, skill, createdAt) as RecommendationRow | undefined;

    return row ? toRecommendation(row) : null;
  }

  private getRecentSessions(childId: string, limit: number) {
    return (
      this.db
        .prepare(
          `SELECT * FROM sessions
           WHERE child_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(childId, limit) as SessionRow[]
    ).map((row) => ({
      sessionId: row.id,
      gameId: row.game_id,
      skill: row.skill,
      templateType: row.template,
      difficultyLevel: getDifficultyLevel(row.difficulty_level),
      score: row.score,
      totalTasks: row.total_tasks,
      accuracy: row.accuracy,
      incorrectAnswers: row.incorrect_answers,
      averageResponseTimeMs: row.average_response_time_ms,
      durationMs: row.duration_ms,
      startedAt: row.started_at,
      endedAt: row.ended_at
    }));
  }

  private getRecentRecommendations(childId: string, limit: number) {
    return (
      this.db
        .prepare(
          `SELECT * FROM recommendations
           WHERE child_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(childId, limit) as RecommendationRow[]
    ).map(toRecommendation);
  }

  private getCommonMistakes(sessionId: string) {
    return (
      this.db
        .prepare(
          `SELECT COALESCE(correct_answer, question_or_item, selected_answer) AS item,
                  COUNT(*) AS count
           FROM events
           WHERE session_id = ?
             AND event_type = 'answer_submitted'
             AND is_correct = 0
           GROUP BY item
           ORDER BY count DESC, item ASC
           LIMIT 3`
        )
        .all(sessionId) as MistakeRow[]
    )
      .map((row) => row.item)
      .filter((item): item is string => Boolean(item));
  }

  private getSkillProgress(child: ChildRow, skill: Skill): SkillProgress {
    const latestSession = this.getLatestSession(child.id, skill);
    const latestRecommendation = this.getLatestRecommendation(child.id, skill);
    const currentLevel = getDifficultyLevel(child[skillLevelColumns[skill]]);
    const metrics = latestSession
      ? sessionRowToMetrics(latestSession, this.getCommonMistakes(latestSession.id))
      : null;

    return {
      level: currentLevel,
      strengths: metrics ? getSkillStrengths(skill, metrics) : [],
      supportAreas: metrics ? getSkillSupportAreas(skill, metrics) : [],
      lastAccuracy: latestSession?.accuracy ?? null,
      lastAvgResponseTimeMs: latestSession?.average_response_time_ms ?? null,
      recommendedFocus: latestRecommendation?.nextFocus ?? "start with a short warm-up"
    };
  }

  private getParentSkillSummary(child: ChildRow, skill: Skill): ParentSkillSummary {
    const rows = this.getSessionRowsForSkill(child.id, skill);
    const latestSession = rows[0];
    const latestRecommendation = this.getLatestRecommendation(child.id, skill);
    const metrics = latestSession
      ? sessionRowToMetrics(latestSession, this.getCommonMistakes(latestSession.id))
      : null;

    return {
      skill,
      label: toSkillLabel(skill),
      sessionsPlayed: rows.length,
      latestAccuracy: latestSession?.accuracy ?? null,
      trend: getParentTrend(rows),
      strengths: metrics ? getSkillStrengths(skill, metrics) : [],
      supportAreas: metrics ? getSkillSupportAreas(skill, metrics) : [],
      recommendedFocus:
        latestRecommendation?.nextFocus ??
        this.getSkillProgress(child, skill).recommendedFocus
    };
  }

  private toParentSessionListItem(row: SessionRow): ParentSessionListItem {
    return {
      sessionId: row.id,
      gameId: row.game_id,
      skill: row.skill,
      skillLabel: toSkillLabel(row.skill),
      templateType: row.template as TemplateType,
      score: row.score,
      totalTasks: row.total_tasks,
      accuracy: row.accuracy,
      averageResponseTimeMs: row.average_response_time_ms,
      durationMs: row.duration_ms,
      interpretation: interpretSession(row),
      startedAt: row.started_at,
      endedAt: row.ended_at
    };
  }
}

function resolveDbPath() {
  if (process.env.KIDS_PLAY_DB_PATH) {
    return path.isAbsolute(process.env.KIDS_PLAY_DB_PATH)
      ? process.env.KIDS_PLAY_DB_PATH
      : path.resolve(repoRoot, process.env.KIDS_PLAY_DB_PATH);
  }

  return path.join(repoRoot, ".data", "kids-play.sqlite");
}

function toRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    childId: row.child_id,
    skill: row.skill,
    summary: row.summary,
    nextFocus: row.next_focus,
    suggestedDifficultyLevel: getDifficultyLevel(row.suggested_difficulty_level),
    createdAt: row.created_at
  };
}

function getDifficultyLevel(value: unknown): DifficultyLevel {
  if (value === 2 || value === 3) {
    return value;
  }

  return 1;
}

function sessionRowToMetrics(
  row: SessionRow,
  commonMistakes: string[]
): CompletedSessionMetrics {
  return {
    score: row.score,
    totalTasks: row.total_tasks,
    correctAnswers: row.correct_answers,
    incorrectAnswers: row.incorrect_answers,
    retries: row.retries,
    hintsUsed: row.hints_used,
    accuracy: row.accuracy,
    averageResponseTimeMs: row.average_response_time_ms,
    durationMs: row.duration_ms,
    commonMistakes,
    lateRoundDrop: false
  };
}

function toSkillLabel(skill: Skill) {
  return `${skill.slice(0, 1).toUpperCase()}${skill.slice(1)}`;
}

function interpretSession(row: SessionRow) {
  if (row.accuracy >= 0.85 && row.incorrect_answers === 0) {
    return "A strong session with steady confidence.";
  }

  if (row.accuracy < 0.6) {
    return "This round could use a little more support next time.";
  }

  return "This session showed steady practice and growing comfort.";
}

function getParentTrend(rows: SessionRow[]): ParentTrend {
  if (rows.length === 0) {
    return "new";
  }

  if (rows[0].accuracy < 0.6) {
    return "needs_support";
  }

  if (rows.length >= 2 && rows[0].accuracy > rows[1].accuracy + 0.05) {
    return "improving";
  }

  return "steady";
}

function buildDashboardSummary(
  displayName: string,
  totalSessions: number,
  strengths: string[],
  supportAreas: string[]
) {
  if (totalSessions === 0) {
    return `No sessions yet for ${displayName}. Once a game is finished, progress will appear here.`;
  }

  const strengthText = strengths[0] ?? "building consistency";
  const supportText = supportAreas[0] ?? "the next round";
  return `${displayName} has completed ${totalSessions} session${totalSessions === 1 ? "" : "s"}, is doing well with ${strengthText}, and can keep practicing ${supportText}.`;
}

function buildSkillSummary(skill: ParentSkillSummary) {
  if (skill.sessionsPlayed === 0) {
    return `No ${skill.label.toLowerCase()} sessions yet.`;
  }

  if (skill.trend === "improving") {
    return `${skill.label} is improving and getting more comfortable.`;
  }

  if (skill.trend === "needs_support") {
    return `${skill.label} still needs gentle support and shorter practice steps.`;
  }

  return `${skill.label} is building consistency through regular practice.`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
