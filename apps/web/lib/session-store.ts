import type { GameSession } from "@kids-play/shared";
import { getLearningStore, resetLearningStoreForTest } from "./learning-store";

export function saveGameSession(session: GameSession) {
  getLearningStore().saveGeneratedGameSession(session);
}

export function getGameSession(gameId: string) {
  return getLearningStore().getGeneratedGameSession(gameId);
}

export function clearGameSessionsForTest() {
  resetLearningStoreForTest();
}
