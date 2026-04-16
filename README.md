# Kids Play Phase 1

A child-friendly practice loop for Reading, Memory, and Attention.

The platform app runs with Next.js on `127.0.0.1:3000`. A separate Vite game runtime runs on `127.0.0.1:3001`, but the child stays inside the platform flow through `/play/[gameId]`, where the game is embedded.

The Phase 1 catalog has six reusable templates: two Reading games, two Memory games, and two Attention games. Codex selects and varies a matching template; it does not invent a new game concept at runtime.

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
KIDS_PLAY_CODEX_MODE=real
```

For automated tests or demos without live Codex auth:

```bash
KIDS_PLAY_CODEX_MODE=mock npm run dev
```

Mock mode still uses the same pre-generated templates and validation path; it only bypasses the live app-server call.

To keep most flows mocked while forcing one skill through live Codex:

```bash
KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_CODEX_LIVE_SKILLS=attention npm run dev
```

The e2e suite uses that mixed mode by default, so the Attention flow asks Codex for a fresh game while Reading and Memory stay fast and predictable.
