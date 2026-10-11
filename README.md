# iSequence

Web app that turns a video name and a prompt into a 60 second, 1080×1920 (9:16) reel.

Claude Opus 5.5 writes every frame as SVG and the server rasterizes it to PNG. Each frame is generated from the previous frame only, one frame per second of video, and ffmpeg blends the 60 frames into a 30 fps MP4.

## Requirements

- Node.js 22 or newer
- A Claude Code OAuth token (`claude setup-token`)

ffmpeg does not need to be installed, it comes with the `ffmpeg-static` package.

## Setup

```sh
npm install
cp .env.example .env
```

Then fill in `.env`. It is gitignored and must never be committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | yes | Authenticates the Claude calls. Without it videos end as `failed` and image requests answer 503. |
| `PORT` | no | Port of the API server, default `3001`. |
| `FRAME_COUNT` | no | Number of frames per video, 1 to 60, default `60`. A small value gives a quick test run. |
| `DATA_DIR` | no | Folder for generated files, default `data/`. |
| `G_TOKEN` | no | GitHub token for `scripts/github.mjs` only, the app does not read it. It needs read and write access to issues and pull requests. |

## Running

Development, with reload on change:

```sh
npm run dev
```

Open http://localhost:5173. Vite serves the client and proxies `/api` and `/media` to the server on `PORT`.

Production:

```sh
npm run build
npm start
```

Open http://localhost:3001. The server serves the built client from `dist/` together with the API.

## Usage

- **Create** (`/`): enter a video name and a prompt, then Generate. The page shows the progress, the latest frame and a filmstrip of all frames so far, and ends with the player and a download button. A running job can be cancelled, a failed or cancelled one can be retried and continues from its saved frames. Reopening the page reattaches to the running job.
- **Videos** (`/videos`): all videos, newest first. Play, download, retry, cancel or delete them.
- **Images** (`/images`): generate a single 1080×1920 image from a prompt, download or delete it.

One video is generated at a time, the others wait in a queue. A full video is 60 Claude calls in a row, so it takes a while. Unfinished jobs resume when the server starts again.

## Generated files

Everything is stored as plain files under `data/` (gitignored):

```
data/videos/<id>/meta.json
data/videos/<id>/frames/001.svg
data/videos/<id>/frames/001.png
data/videos/<id>/output.mp4
data/images/<id>.svg
data/images/<id>.png
data/images/<id>.json
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client in watch mode |
| `npm run build` | Builds the client into `dist/` |
| `npm start` | Starts the server |
| `npm test` | Runs the tests in `tests/` (no Claude calls, the encode test runs the real ffmpeg) |
| `npm run typecheck` | Type checks the server and the client |

## Project layout

```
src/              React client (pages, components, hooks, api)
server/           Express server
  claude/         Claude client, prompt builders, SVG validation
  jobs/           Video job queue
  render/         SVG to PNG, ffmpeg encoding
  routes/         /api/images and /api/videos
  store/          File storage
  types.ts        Global types
tests/            node:test suites
scripts/          GitHub tooling
```

## Contributing

Progress, decisions and the next task are in [Tasks.md](Tasks.md), the code rules in [CLAUDE.md](CLAUDE.md).

Work happens on `feat/<issue>-<slug>` or `fix/<issue>-<slug>` branches. `npm install` points git at `.githooks`, and the `prepare-commit-msg` hook there adds `[<issue>]` in front of every commit message on those branches. Issues and pull requests are managed with `node scripts/github.mjs`:

```sh
node scripts/github.mjs issues
node scripts/github.mjs pr <head> <base> "<title>" [issue]
node scripts/github.mjs close <number>
```
