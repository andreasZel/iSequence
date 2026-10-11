# iSequence Tasks

Web app that turns a video name and a prompt into a 60 second 1080×1920 (9:16) reel. Opus 5.5 writes each frame as SVG, the server rasterizes it to PNG, and every next frame is generated from the previous frame only. Pages: Create, Videos (older videos), Images (single image generation).

This file is the source of truth for progress. Read it at the start of every session.

## Session workflow

1. Read this file and pick the first task whose status is not `done`.
2. Create the branch `feat/<issue>-<slug>` (or `fix/<issue>-<slug>` for bugs) from the latest finished work.
3. Set the task's `Status` to `in progress` and fill in `Branch`.
4. Do the work, ticking checklist items as they are finished.
5. Commit. The `prepare-commit-msg` hook adds `[<issue>]` in front of the message.
6. Set `Status` to `done`, add a line to the session log, commit, push the branch.
7. Open a pull request with `node scripts/github.mjs pr <branch> <base> "<title>" <issue>`.

Rules:

- `.env` holds `G_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`. It is never committed. Stage files by path.
- New tasks or bugs: add a section here with `Issue: pending`, then run `node scripts/github.mjs issues`.
- Run `git config core.hooksPath .githooks` once per clone (`npm install` does it too).
- Pull requests are merged by the repo owner only. If the previous pull request is not merged yet, branch the next task from the previous task branch and use that branch as the pull request base.
- Commit messages carry no Claude attribution.

## Decisions

- Frames are Claude-authored SVG with `viewBox="0 0 1080 1920"`, rasterized with `@resvg/resvg-js`.
- 60 generated frames, one per second, blended to 30 fps by ffmpeg (`ffmpeg-static`).
- Claude calls go through `@anthropic-ai/claude-agent-sdk`, model `claude-opus-5-5`, authenticated by `CLAUDE_CODE_OAUTH_TOKEN` from `.env`, tools disabled.
- Frame N receives only the video prompt, its index, and frame N-1 (SVG source and rendered PNG). Each call is a fresh query. Frame N starts only after frame N-1 is saved.
- Storage is plain files under `data/` (gitignored): `data/videos/<id>/meta.json`, `frames/001.svg`, `frames/001.png`, `output.mp4`, and `data/images/<id>.{svg,png,json}`.
- Stack: Vite + React + react-router client in `src/`, Express server in `server/` run with `tsx`, global types in `server/types.ts`.

## Tasks

### T1 — Repo bootstrap and workflow tooling
- Issue: #1
- Status: done
- Branch: feat/1-repo-bootstrap

- [x] `.gitignore` and `.env.example`
- [x] `Tasks.md` with workflow, decisions and tasks
- [x] `scripts/github.mjs` to create issues, close issues and open pull requests with `G_TOKEN`
- [x] `.githooks/prepare-commit-msg` adding `[<issue>]` from `feat/<issue>` and `fix/<issue>` branches
- [x] `CLAUDE.md` deduplicated and extended with the session workflow
- [x] Issues created on GitHub

### T2 — Scaffold Vite, React, Express and TypeScript
- Issue: #2
- Status: done
- Branch: feat/2-scaffold

- [x] `package.json` with `dev`, `build`, `start`, `typecheck`, `test` and `prepare` scripts
- [x] Vite + React client in `src/` with `/api` and `/media` proxied to the server
- [x] Express server in `server/index.ts` loading `.env`, with a health route
- [x] Router and nav shell with Create, Videos and Images pages as placeholders

### T3 — Types and file storage
- Issue: #3
- Status: done
- Branch: feat/3-types-storage

- [x] Global types in `server/types.ts` (video, frame, image, job status, events)
- [x] `server/store/videos.ts`: create, read, update, list, delete, frame paths
- [x] `server/store/images.ts`: create, list, delete
- [x] `/media` static serving of `data/`

### T4 — Claude client
- Issue: #4
- Status: todo
- Branch: none

- [ ] Agent SDK wrapper using `claude-opus-5-5` and `CLAUDE_CODE_OAUTH_TOKEN`, tools disabled
- [ ] Prompt builders for first frame, next frame and single image
- [ ] Previous frame passed as SVG source plus PNG image block
- [ ] SVG extraction and validation (root element, viewBox, no scripts or external references)
- [ ] Clear configuration error when the token is missing

### T5 — SVG to PNG renderer
- Issue: #5
- Status: todo
- Branch: none

- [ ] `server/render/svgToPng.ts` using `@resvg/resvg-js`
- [ ] Output always exactly 1080×1920 with an opaque background
- [ ] Render errors surfaced so the caller can retry the frame

### T6 — Image generation API and Images page
- Issue: #6
- Status: todo
- Branch: none

- [ ] `POST /api/images`, `GET /api/images`, `DELETE /api/images/:id`
- [ ] Images page: prompt form, pending state, gallery, download, delete

### T7 — Video job pipeline
- Issue: #7
- Status: todo
- Branch: none

- [ ] Sequential chain: frame N generated from frame N-1 only, after it is saved
- [ ] Up to 3 attempts per frame, then the job is marked `failed`
- [ ] Single running job with a queue for the rest
- [ ] Progress persisted in `meta.json` after every frame
- [ ] Jobs left in `generating` or `queued` resume on server start
- [ ] `FRAME_COUNT` override for quick test runs

### T8 — ffmpeg assembly
- Issue: #8
- Status: todo
- Branch: none

- [ ] `server/render/encode.ts` with `ffmpeg-static`
- [ ] 60 PNG frames to a 60 second 1080×1920 H.264 yuv420p MP4 at 30 fps with blended transitions
- [ ] Called by the job after the last frame, status becomes `done`

### T9 — Video API and progress events
- Issue: #9
- Status: todo
- Branch: none

- [ ] `POST /api/videos` with required `name` and `prompt`
- [ ] `GET /api/videos`, `GET /api/videos/:id`, `DELETE /api/videos/:id`, `POST /api/videos/:id/retry`
- [ ] `GET /api/videos/:id/events` SSE stream with frame, status and error events

### T10 — Create Video page
- Issue: #10
- Status: todo
- Branch: none

- [ ] Form with required video name and prompt, Generate button
- [ ] Live progress (N of 60), latest frame preview and filmstrip
- [ ] Final player and download when the job is done
- [ ] Reopening the page for a running job reattaches to its progress

### T11 — Videos library page
- Issue: #11
- Status: todo
- Branch: none

- [ ] List of older videos with name, date, status and first frame thumbnail
- [ ] Play, download and delete
- [ ] Retry for failed videos and a link to the progress of running ones

### T12 — Failure handling and polish
- Issue: #12
- Status: todo
- Branch: none

- [ ] Cancel a running job
- [ ] Error, empty and loading states on all pages
- [ ] Responsive layout
- [ ] Token never sent to the client or written to logs

### T13 — Tests and README
- Issue: #13
- Status: todo
- Branch: none

- [ ] Tests for prompt builders and SVG validation
- [ ] Test that the renderer outputs 1080×1920
- [ ] Test for the commit message hook
- [ ] Test for job resume with a fake Claude client
- [ ] README with setup, `.env` variables and usage

## Session log

- 2026-10-11: T1 files written on `feat/1-repo-bootstrap`. Issues not created yet, GitHub rejects `G_TOKEN` (401). The repo had no issues, so tasks T1 to T13 will become issues #1 to #13 if `node scripts/github.mjs issues` runs before any pull request is opened. Branch names already assume that.
- 2026-10-11: T2 done on `feat/2-scaffold` (branched from `feat/1-repo-bootstrap`). Typecheck and client build pass, `/api/health` responds. `.env` is loaded with Node's `process.loadEnvFile`, no `dotenv` dependency. No pull requests opened yet, they need a working `G_TOKEN`. Next: T3.
- 2026-10-11: Issues #1 to #13 created, T1 and T2 merged into `master`. T3 done on `feat/3-types-storage` (from `master`). `/media` serves only `.png` and `.mp4`, ids must be UUIDs, the data folder can be moved with `DATA_DIR`. Store tests pass with `npm test`. Next: T4, which needs `CLAUDE_CODE_OAUTH_TOKEN` in `.env` to be tested for real (not set yet).

