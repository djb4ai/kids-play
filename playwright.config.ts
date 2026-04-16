import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_CODEX_LIVE_SKILLS=attention GAME_RUNTIME_ORIGIN=http://127.0.0.1:3001 VITE_PLATFORM_ORIGIN=http://127.0.0.1:3000 npm run dev",
    url: "http://127.0.0.1:3000",
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
