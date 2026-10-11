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
- Status: done
- Branch: feat/4-claude-client

- [x] Agent SDK wrapper using `claude-opus-5-5` and `CLAUDE_CODE_OAUTH_TOKEN`, tools disabled
- [x] Prompt builders for first frame, next frame and single image
- [x] Previous frame passed as SVG source plus PNG image block
- [x] SVG extraction and validation (root element, viewBox, no scripts or external references)
- [x] Clear configuration error when the token is missing

### T5 — SVG to PNG renderer
- Issue: #5
- Status: done
- Branch: feat/5-svg-renderer

- [x] `server/render/svgToPng.ts` using `@resvg/resvg-js`
- [x] Output always exactly 1080×1920 with an opaque background
- [x] Render errors surfaced so the caller can retry the frame

### T6 — Image generation API and Images page
- Issue: #6
- Status: done
- Branch: feat/6-images

- [x] `POST /api/images`, `GET /api/images`, `DELETE /api/images/:id`
- [x] Images page: prompt form, pending state, gallery, download, delete

### T7 — Video job pipeline
- Issue: #7
- Status: done
- Branch: feat/7-video-jobs

- [x] Sequential chain: frame N generated from frame N-1 only, after it is saved
- [x] Up to 3 attempts per frame, then the job is marked `failed`
- [x] Single running job with a queue for the rest
- [x] Progress persisted in `meta.json` after every frame
- [x] Jobs left in `generating` or `queued` resume on server start
- [x] `FRAME_COUNT` override for quick test runs

### T8 — ffmpeg assembly
- Issue: #8
- Status: done
- Branch: feat/8-ffmpeg-assembly

- [x] `server/render/encode.ts` with `ffmpeg-static`
- [x] 60 PNG frames to a 60 second 1080×1920 H.264 yuv420p MP4 at 30 fps with blended transitions
- [x] Called by the job after the last frame, status becomes `done`

### T9 — Video API and progress events
- Issue: #9
- Status: done
- Branch: feat/9-video-api

- [x] `POST /api/videos` with required `name` and `prompt`
- [x] `GET /api/videos`, `GET /api/videos/:id`, `DELETE /api/videos/:id`, `POST /api/videos/:id/retry`
- [x] `GET /api/videos/:id/events` SSE stream with frame, status and error events

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

- [x] Tests for prompt builders and SVG validation
- [x] Test that the renderer outputs 1080×1920
- [ ] Test for the commit message hook
- [x] Test for job resume with a fake Claude client
- [ ] README with setup, `.env` variables and usage

## Session log

- 2026-10-11: T1 files written on `feat/1-repo-bootstrap`. Issues not created yet, GitHub rejects `G_TOKEN` (401). The repo had no issues, so tasks T1 to T13 will become issues #1 to #13 if `node scripts/github.mjs issues` runs before any pull request is opened. Branch names already assume that.
- 2026-10-11: T2 done on `feat/2-scaffold` (branched from `feat/1-repo-bootstrap`). Typecheck and client build pass, `/api/health` responds. `.env` is loaded with Node's `process.loadEnvFile`, no `dotenv` dependency. No pull requests opened yet, they need a working `G_TOKEN`. Next: T3.
- 2026-10-11: Issues #1 to #13 created, T1 and T2 merged into `master`. T3 done on `feat/3-types-storage` (from `master`). `/media` serves only `.png` and `.mp4`, ids must be UUIDs, the data folder can be moved with `DATA_DIR`. Store tests pass with `npm test`. Next: T4, which needs `CLAUDE_CODE_OAUTH_TOKEN` in `.env` to be tested for real (not set yet).
- 2026-10-11: T4 done on `feat/4-claude-client` (from `master`). Claude code lives in `server/claude/`: `client.ts` (`askClaude`), `prompts.ts`, `svg.ts`, `generate.ts` (`generateFirstFrameSvg`, `generateNextFrameSvg`, `generateImageSvg`, all return a validated SVG string). Validation rejects `<image>` and `<foreignObject>` too. Tests for prompts and validation are in `tests/claude.test.ts` (T13 item ticked). No real Claude call was made, `CLAUDE_CODE_OAUTH_TOKEN` is still not in `.env`, so the SDK call in `askClaude` is only typechecked. Next: T5.
- 2026-10-11: T5 done on `feat/5-svg-renderer` (from `feat/4-claude-client`, its pull request is not open yet: `G_TOKEN` gets 403 on `POST /pulls`, it needs the "Pull requests: read and write" permission). `svgToPng(svg)` in `server/render/svgToPng.ts` is synchronous, returns a PNG `Buffer` and throws `SvgRenderError`. It overrides the root `width`, `height` and `preserveAspectRatio` so the output is always 1080×1920, on a black background. Tests in `tests/render.test.ts` (T13 item ticked). Next: T6.
- 2026-10-11: T6 done on `feat/6-images` (from `feat/5-svg-renderer`, pull requests for T4 and T5 still not open, `G_TOKEN` gets 403 on `POST /pulls`). `server/routes/images.ts` exports `createImagesRouter(generate)`, the generator is injectable so `tests/images-api.test.ts` runs with a fake Claude. `POST /api/images` retries once on an invalid or unrenderable SVG, answers 503 when the token is missing and 502 on other generation failures; prompts are capped at 2000 characters. Client calls live in `src/api/images.ts`, the card in `src/components/ImageCard.tsx`. The page was not opened in a browser and no real image was generated, `CLAUDE_CODE_OAUTH_TOKEN` is still not in `.env`. Next: T7.
- 2026-10-11: T7 done on `feat/7-video-jobs` (from `feat/6-images`, pull requests for T4 to T6 still not open, `G_TOKEN` gets 403 on `POST /pulls`). `createVideoJobs(deps)` in `server/jobs/videoJobs.ts` returns `enqueue`, `resume`, `cancel`, `subscribe`, `whenIdle`, `isPending`, `runningId`; Claude, renderer and encoder are injectable. `server/index.ts` creates the instance and calls `resume()` on start, T9 should pass that instance to the videos router and create videos with `resolveFrameCount()`. The default `encode` throws "not implemented", so until T8 a real job ends as `failed` after its last frame; T8 replaces that default. A missing token fails the job without retries, other errors wait 2 s between attempts. `cancel` already exists for T12. Tests in `tests/video-jobs.test.ts` with fakes (T13 resume item ticked), no real Claude run. Next: T8.
- 2026-10-11: T8 done on `feat/8-ffmpeg-assembly` (from `feat/7-video-jobs`). `encodeVideo(video, signal)` in `server/render/encode.ts` is now the default `encode` of `createVideoJobs`. ffmpeg reads `frames/%03d.png` at 1 fps and the `framerate` filter cross-fades each frame into the next over its whole second (`scene=100`, otherwise scene detection skips the blend); the last frame is held for its second, so the length is exactly `frameCount` seconds. It writes `output.tmp.mp4` and renames it to `output.mp4`, throws `VideoEncodeError` with the ffmpeg stderr, and the abort signal kills ffmpeg. A 60 frame test reel encoded in about 24 s to a 60.00 s file. Tests in `tests/encode.test.ts` run the real ffmpeg binary, still no real Claude run. `/media/videos/<id>/output.mp4` is already servable. Next: T9.
- 2026-10-11: T9 done on `feat/9-video-api` (from `feat/8-ffmpeg-assembly`, pull requests for T4 to T8 still not open, `G_TOKEN` gets 403 on `POST /pulls`). `createVideosRouter(jobs)` in `server/routes/videos.ts` is mounted on `/api/videos`. `POST` answers 201 with the queued video (name up to 120 characters, prompt up to 2000) and never waits for Claude; a missing token shows up as a `failed` video with the error text. `DELETE` cancels the job first. `retry` answers 202 for `failed` or `cancelled` videos, 409 otherwise, and resumes from the saved frames. The SSE stream sends a `snapshot` event with the whole video first (type `VideoStreamEvent` in `server/types.ts`), then `frame`, `status` and `error` events, and stays open with a ping every 15 s, so the client must close it. Frames are at `/media/videos/<id>/frames/001.png`, the result at `/media/videos/<id>/output.mp4`. The server error handler now answers 4xx errors (missing media file, malformed JSON) with their own status instead of 500. Tests in `tests/videos-api.test.ts`; a smoke run on the real server worked up to the expected `failed` status, `CLAUDE_CODE_OAUTH_TOKEN` is still not in `.env`. Next: T10.
