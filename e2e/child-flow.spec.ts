import { expect, test, type Page } from "@playwright/test";

type Skill = "reading" | "memory" | "attention";

type GameRoundForTest = {
  id: string;
  correctChoice?: string;
  correctSequence?: string[];
};

type GameSessionForTest = {
  gameId: string;
  skill: Skill;
  rounds: GameRoundForTest[];
};

for (const skill of ["reading", "memory", "attention"] as const) {
  test(`child can launch and complete a ${skill} session`, async ({ page }, testInfo) => {
    testInfo.setTimeout(skill === "attention" ? 90_000 : 45_000);

    await page.goto("/");
    await page.getByTestId(`skill-${skill}`).click();

    await expect(page.getByTestId("generation-status")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/play/game_${skill}_[a-f0-9]{8}`), {
      timeout: skill === "attention" ? 70_000 : 30_000
    });

    const gameId = getGameIdFromPageUrl(page.url());
    const session = await loadGeneratedSession(page, gameId);

    expect(session.skill).toBe(skill);
    expect(session.gameId).toBe(gameId);

    const frameElement = page.getByTestId("game-frame");
    await expect(frameElement).toBeVisible();

    const game = page.frameLocator('[data-testid="game-frame"]');
    await expect(game.getByTestId("game-runtime")).toBeVisible();

    for (const round of session.rounds) {
      await expect(game.getByText(round.id.replace(/_/g, " "))).toBeVisible();

      for (const choice of getCorrectChoices(round)) {
        const button = game.getByTestId(`choice-${choice}`);
        await expect(button).toBeEnabled();
        await button.click();
      }

      await expect(game.getByTestId("game-feedback")).toBeVisible();
    }

    await expect(game.getByTestId("game-complete")).toBeVisible();
    await expect(page.getByTestId("play-complete")).toBeVisible();
    expect(page.url()).toContain("127.0.0.1:3000/play/");
  });
}

function getGameIdFromPageUrl(url: string) {
  const gameId = new URL(url).pathname.split("/").at(-1);

  if (!gameId) {
    throw new Error(`Could not read game id from ${url}`);
  }

  return gameId;
}

async function loadGeneratedSession(page: Page, gameId: string) {
  const response = await page.request.get(`/api/games/${encodeURIComponent(gameId)}`);

  expect(response.ok()).toBe(true);

  return (await response.json()) as GameSessionForTest;
}

function getCorrectChoices(round: GameRoundForTest) {
  if (round.correctSequence?.length) {
    return round.correctSequence;
  }

  if (round.correctChoice) {
    return [round.correctChoice];
  }

  throw new Error(`Round ${round.id} does not have a playable answer.`);
}
