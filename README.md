# Kids Play Phase 2

A child-friendly practice loop for Reading, Memory, and Attention.

The platform app runs with Next.js on `127.0.0.1:3000`. A separate Vite game runtime runs on `127.0.0.1:3001`, but the child stays inside the platform flow through `/play/[gameId]`, where the game is embedded.

The catalog has six reusable templates: two Reading games, two Memory games, and two Attention games. Codex selects and varies a matching template; it does not invent a new game concept at runtime.

Phase 2 adds a SQLite-backed learning loop. The app stores generated games, completed sessions, gameplay events, learner progress, and the next recommendation for the demo child.

## Scripts

```bash
npm install
npm run dev
npm run build
npm test
npm run test:e2e
```

## Codex App-Server

By default, `POST /api/games/generate` uses `codex app-server` over stdio. The server constrains Codex with a JSON schema and validates the result with Zod before creating a game session.

Useful environment values:

```bash
CODEX_MODEL=gpt-5.4
GAME_RUNTIME_ORIGIN=http://127.0.0.1:3001
KIDS_PLAY_DB_PATH=.data/kids-play.sqlite
KIDS_PLAY_CODEX_MODE=real
OPENAI_API_KEY=sk-...
OPENAI_INSIGHTS_MODEL=gpt-5-nano
```

If `OPENAI_API_KEY` is present, completed sessions use the OpenAI API to polish the progress summary and next-focus insight. If it is missing or the request fails, the app falls back to the local explainable recommendation rules.

For automated tests or demos without live Codex auth:

```bash
KIDS_PLAY_CODEX_MODE=mock npm run dev
```

Mock mode still uses the same pre-generated templates and validation path; it only bypasses the live app-server call.
Mock mode also applies deterministic adaptations from stored recommendations, so demos and e2e tests show the returning-child learning loop without live Codex auth.

To keep most flows mocked while forcing one skill through live Codex:

```bash
KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_CODEX_LIVE_SKILLS=attention npm run dev
```

The e2e suite runs in all-mock mode by default with an isolated SQLite database. It starts its own servers on `127.0.0.1:3100` and `127.0.0.1:3101` to avoid reusing a dev server with different settings.
