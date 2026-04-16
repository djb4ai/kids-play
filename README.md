# Kids Play

A child-friendly practice loop for Reading, Memory, and Attention.

The platform app runs with Next.js on `127.0.0.1:3000`. A separate Vite game runtime runs on `127.0.0.1:3001`, and the child stays inside the platform flow through `/play/[gameId]`, where the game is embedded.

The app stores generated games, completed sessions, gameplay events, learner progress, and the next recommendation for the demo child in SQLite.

## How To Run

Run everything from the repo root.

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local env file

```bash
cp .env.example .env
```

The workspace apps load the repo-root `.env` automatically.

### 3. Pick a run mode

#### Recommended for local development

This keeps Reading and Memory fast and local, while Attention still uses `codex app-server`.

```bash
KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_CODEX_LIVE_SKILLS=attention npm run dev
```

#### Fully mocked

Use this if you do not want any live Codex generation.

```bash
KIDS_PLAY_CODEX_MODE=mock npm run dev
```

#### Fully live

Use this only if you want all skills to generate through `codex app-server`.

```bash
KIDS_PLAY_CODEX_MODE=real npm run dev
```

### 4. Open the app

- Platform: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Game runtime: [http://127.0.0.1:3001](http://127.0.0.1:3001)

## Environment

Example values:

```bash
CODEX_MODEL=gpt-5.4
GAME_RUNTIME_ORIGIN=http://127.0.0.1:3001
KIDS_PLAY_DB_PATH=.data/kids-play.sqlite
KIDS_PLAY_CODEX_MODE=mock
KIDS_PLAY_CODEX_LIVE_SKILLS=attention
OPENAI_API_KEY=
OPENAI_INSIGHTS_MODEL=gpt-5-nano
VITE_PLATFORM_ORIGIN=http://127.0.0.1:3000
```

### Important env values

- `KIDS_PLAY_CODEX_MODE`
  - `mock`: use local mock generation unless a skill is explicitly forced live
  - `real`: use live Codex generation for all skills
- `KIDS_PLAY_CODEX_LIVE_SKILLS`
  - comma-separated skill list such as `attention`
  - useful with `KIDS_PLAY_CODEX_MODE=mock`
- `KIDS_PLAY_DB_PATH`
  - relative paths are resolved from the repo root
  - default: `.data/kids-play.sqlite`
- `GAME_RUNTIME_ORIGIN`
  - URL for the Vite game runtime
- `VITE_PLATFORM_ORIGIN`
  - URL for the Next.js platform app
- `OPENAI_API_KEY`
  - optional
  - if present, completed sessions use the OpenAI API to polish progress summaries

## Codex App-Server

`POST /api/games/generate` can use `codex app-server` over stdio.

Current local recommendation:

- Reading: mocked
- Memory: mocked
- Attention: live through `codex app-server`

That setup gives you fast local iteration while still exercising the live Attention generation path.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
```

## Ports

Default ports:

- web: `3000`
- game: `3001`

If you need different ports:

```bash
WEB_PORT=3002 GAME_PORT=3003 GAME_RUNTIME_ORIGIN=http://127.0.0.1:3003 VITE_PLATFORM_ORIGIN=http://127.0.0.1:3002 npm run dev
```

Then open:

- [http://127.0.0.1:3002](http://127.0.0.1:3002)
- [http://127.0.0.1:3003](http://127.0.0.1:3003)

## Data

The SQLite database lives at:

```bash
.data/kids-play.sqlite
```

To clear local learning state:

```bash
rm -f .data/kids-play.sqlite .data/kids-play.sqlite-shm .data/kids-play.sqlite-wal
rm -f apps/web/.data/kids-play.sqlite apps/web/.data/kids-play.sqlite-shm apps/web/.data/kids-play.sqlite-wal
```

## Testing

```bash
npm test
npm run typecheck
npm run test:e2e
```

The e2e suite uses its own isolated SQLite database and starts its own servers on `127.0.0.1:3100` and `127.0.0.1:3101`.

## Troubleshooting

### A tile click does nothing or feels stuck

Check whether you are running fully live generation. Live `codex app-server` requests are slower than mocked generation.

Recommended local setup:

```bash
KIDS_PLAY_CODEX_MODE=mock KIDS_PLAY_CODEX_LIVE_SKILLS=attention npm run dev
```

### Next.js throws a missing `.next` file error

Stop the dev server, clear the Next cache, and start again:

```bash
rm -rf apps/web/.next
npm run dev
```
