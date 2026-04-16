import { expect, test, type Page } from "@playwright/test";

type Skill = "reading" | "memory" | "attention";

type GameRoundForTest = {
  id: string;
  choices: string[];
  correctChoice?: string;
  correctSequence?: string[];
};

type GameSessionForTest = {
  gameId: string;
  skill: Skill;
  title: string;
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
    expect(new URL(page.url()).pathname).toContain("/play/");
  });
}

test("a returning reading session adapts after missed words", async ({ page }) => {
  const childId = "e2e_adapt_child";
  const firstResponse = await page.request.post("/api/games/generate", {
    data: {
      childId,
      skill: "reading",
      ageGroup: "5-8",
      difficultyLevel: 1
    }
  });
  expect(firstResponse.ok()).toBe(true);

  const firstLaunch = (await firstResponse.json()) as { gameId: string };
  const firstSession = await loadGeneratedSession(page, firstLaunch.gameId);

  await page.goto(`/play/${firstLaunch.gameId}`);
  const game = page.frameLocator('[data-testid="game-frame"]');
  await expect(game.getByTestId("game-runtime")).toBeVisible();

  for (const round of firstSession.rounds) {
    const correctChoice = round.correctChoice;
    if (!correctChoice) {
      throw new Error("Expected reading round to have a correct choice.");
    }

    const wrongChoice = round.choices.find((choice) => choice !== correctChoice);
    if (!wrongChoice) {
      throw new Error("Expected reading round to have a distractor.");
    }

    await game.getByTestId(`choice-${wrongChoice}`).click();
    await game.getByTestId(`choice-${correctChoice}`).click();
  }

  await expect(game.getByTestId("game-complete")).toBeVisible();
  await expect(page.getByTestId("play-complete")).toBeVisible();

  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/learner-profile/${encodeURIComponent(childId)}`
      );
      const profile = (await response.json()) as {
        recommendations?: Array<{ nextFocus: string }>;
      };
      return profile.recommendations?.[0]?.nextFocus ?? "";
    })
    .toContain("repeat");

  const secondResponse = await page.request.post("/api/games/generate", {
    data: {
      childId,
      skill: "reading",
      ageGroup: "5-8",
      difficultyLevel: 1
    }
  });
  expect(secondResponse.ok()).toBe(true);

  const secondLaunch = (await secondResponse.json()) as { gameId: string };
  const secondSession = await loadGeneratedSession(page, secondLaunch.gameId);

  expect(secondSession.title).toBe("Reading Gentle Repeat");
  expect(secondSession.rounds[0].choices).toHaveLength(2);
});

test("choose another skill returns to the home screen from the runtime button", async ({
  page
}) => {
  await page.goto("/");
  await page.getByTestId("skill-reading").click();
  await expect(page).toHaveURL(new RegExp("/play/game_reading_[a-f0-9]{8}"));
  const gameId = getGameIdFromPageUrl(page.url());
  const session = await loadGeneratedSession(page, gameId);

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
  await game.getByTestId("game-home-button").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("skill-reading")).toBeVisible();
});

test("parent dashboard shows progress after a few sessions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("skill-reading").click();
  await expect(page).toHaveURL(new RegExp("/play/game_reading_[a-f0-9]{8}"));
  await finishSessionFromPage(page);

  await page.goto("/");
  await page.getByTestId("skill-memory").click();
  await expect(page).toHaveURL(new RegExp("/play/game_memory_[a-f0-9]{8}"));
  await finishSessionFromPage(page);

  await page.goto("/parent/demo_child/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: /progress/i })).toBeVisible();
  await expect(page.getByText("Sessions played", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Recent sessions" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Next session focus" })).toBeVisible();

  await page.getByRole("link", { name: "Details" }).first().click();
  await expect(page).toHaveURL(/\/parent\/demo_child\/sessions\/session_/);
  await expect(page.getByText(/Round details/i)).toBeVisible();

  await page.goto("/parent/demo_child/dashboard");
  await page.getByRole("link", { name: /Reading|Memory|Attention/ }).first().click();
  await expect(page).toHaveURL(/\/parent\/demo_child\/skills\//);
  await expect(page.getByText(/Next focus/i)).toBeVisible();
});

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

async function finishSessionFromPage(page: Page) {
  const gameId = getGameIdFromPageUrl(page.url());
  const session = await loadGeneratedSession(page, gameId);
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
}
