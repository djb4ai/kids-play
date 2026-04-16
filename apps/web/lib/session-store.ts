import type { GameSession } from "@kids-play/shared";

declare global {
  var __kidsPlaySessions: Map<string, GameSession> | undefined;
}

const sessions = globalThis.__kidsPlaySessions ?? new Map<string, GameSession>();

if (!globalThis.__kidsPlaySessions) {
  globalThis.__kidsPlaySessions = sessions;
}

export function saveGameSession(session: GameSession) {
  sessions.set(session.gameId, session);
}

export function getGameSession(gameId: string) {
  return sessions.get(gameId) ?? null;
}

export function clearGameSessionsForTest() {
  sessions.clear();
}
