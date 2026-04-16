import { defineConfig, devices } from "@playwright/test";

const platformOrigin = "http://127.0.0.1:3100";
const gameRuntimeOrigin = "http://127.0.0.1:3101";
const dbPath = `/tmp/kids-play-e2e-${Date.now()}.sqlite`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: platformOrigin,
    trace: "on-first-retry"
  },
  webServer: {
    command: `KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_DB_PATH=${dbPath} WEB_PORT=3100 GAME_PORT=3101 GAME_RUNTIME_ORIGIN=${gameRuntimeOrigin} VITE_PLATFORM_ORIGIN=${platformOrigin} npm run dev`,
    url: platformOrigin,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
