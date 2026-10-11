import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { ClaudeConfigError } from '../claude/client';
import { generateFirstFrameSvg, generateNextFrameSvg } from '../claude/generate';
import { describeError, logError } from '../redact';
import { encodeVideo } from '../render/encode';
import { svgToPng } from '../render/svgToPng';
import { countSavedFrames, getVideo, listVideos, readFrame, saveFrame, updateVideo } from '../store/videos';
import type { Frame, Video, VideoEvent, VideoStatus } from '../types';

export const DEFAULT_FRAME_COUNT = 60;
export const MAX_FRAME_COUNT = 60;
export const MAX_FRAME_ATTEMPTS = 3;

const RESUMABLE: VideoStatus[] = ['generating', 'encoding', 'queued'];

const DEFAULT_DEPS: VideoJobDeps = {
    generateFirst: generateFirstFrameSvg,
    generateNext: generateNextFrameSvg,
    render: svgToPng,
    encode: encodeVideo,
    retryDelayMs: 2000
};

// FRAME_COUNT shortens test runs, the reel default is 60.
export function resolveFrameCount() {
    const value = Number(process.env.FRAME_COUNT);
    return Number.isInteger(value) && value >= 1 && value <= MAX_FRAME_COUNT ? value : DEFAULT_FRAME_COUNT;
}

export function createVideoJobs(overrides: Partial<VideoJobDeps> = {}) {
    const deps = { ...DEFAULT_DEPS, ...overrides };
    const emitter = new EventEmitter();
    const queue: string[] = [];
    let running: { id: string; controller: AbortController; finished: Promise<void> } | null = null;
    let active: Promise<void> | null = null;

    const emit = (event: VideoEvent) => void emitter.emit('event', event);

    async function setStatus(id: string, status: VideoStatus, error: string | null = null) {
        const video = await updateVideo(id, { status, error });
        emit({ type: 'status', videoId: id, status });
        return video;
    }

    async function drawFrame(video: Video, index: number, previous: Frame | null, signal: AbortSignal) {
        for (let attempt = 1; ; attempt++) {
            try {
                const svg = previous ? await deps.generateNext(video.prompt, index, video.frameCount, previous, signal) : await deps.generateFirst(video.prompt, video.frameCount, signal);
                return { index, svg, png: deps.render(svg) } satisfies Frame;
            } catch (error) {
                if (signal.aborted || error instanceof ClaudeConfigError || attempt === MAX_FRAME_ATTEMPTS) throw error;
                await delay(deps.retryDelayMs, undefined, { signal });
            }
        }
    }

    async function run(id: string, signal: AbortSignal) {
        try {
            const stored = await getVideo(id);
            if (!stored) return;
            const framesDone = await countSavedFrames(id, stored.frameCount);
            await updateVideo(id, { framesDone });
            const video = await setStatus(id, 'generating');
            let previous: Frame | null = framesDone > 0 ? await readFrame(id, framesDone) : null;
            for (let index = framesDone + 1; index <= video.frameCount; index++) {
                signal.throwIfAborted();
                const frame = await drawFrame(video, index, previous, signal);
                signal.throwIfAborted();
                await saveFrame(id, frame);
                previous = frame;
                await updateVideo(id, { framesDone: index });
                emit({ type: 'frame', videoId: id, index, frameCount: video.frameCount });
            }
            signal.throwIfAborted();
            await setStatus(id, 'encoding');
            await deps.encode(video, signal);
            signal.throwIfAborted();
            await setStatus(id, 'done');
        } catch (error) {
            if (!(await getVideo(id))) return;
            if (signal.aborted) return void await setStatus(id, 'cancelled');
            const message = describeError(error);
            emit({ type: 'error', videoId: id, message });
            await setStatus(id, 'failed', message);
        }
    }

    function start(id: string) {
        const controller = new AbortController();
        const finished = run(id, controller.signal).catch((error) => logError('Video job crashed', error)).finally(() => {
            running = null;
        });
        running = { id, controller, finished };
        return finished;
    }

    function pump() {
        if (active) return;
        active = (async () => {
            while (queue.length > 0) await start(queue.shift()!);
        })().finally(() => {
            active = null;
            if (queue.length > 0) pump();
        });
    }

    function isPending(id: string) {
        return running?.id === id || queue.includes(id);
    }

    async function enqueue(id: string) {
        if (isPending(id)) return;
        queue.push(id);
        const video = await getVideo(id);
        if (video && video.status !== 'queued') await setStatus(id, 'queued');
        pump();
    }

    async function resume() {
        const videos = (await listVideos()).filter((video) => RESUMABLE.includes(video.status));
        videos.sort((a, b) => RESUMABLE.indexOf(a.status) - RESUMABLE.indexOf(b.status) || a.createdAt.localeCompare(b.createdAt));
        for (const video of videos) {
            if (isPending(video.id)) continue;
            queue.push(video.id);
        }
        pump();
        return videos.length;
    }

    async function cancel(id: string) {
        if (running?.id === id) {
            running.controller.abort();
            return void await running.finished;
        }
        const position = queue.indexOf(id);
        if (position === -1) return;
        queue.splice(position, 1);
        if (await getVideo(id)) await setStatus(id, 'cancelled');
    }

    function subscribe(listener: (event: VideoEvent) => void) {
        emitter.on('event', listener);
        return () => void emitter.off('event', listener);
    }

    async function whenIdle() {
        while (active) await active;
    }

    return { enqueue, resume, cancel, subscribe, whenIdle, isPending, runningId: () => running?.id ?? null };
}

export type VideoJobs = ReturnType<typeof createVideoJobs>;

export type VideoJobDeps = {
    generateFirst: (prompt: string, frameCount: number, signal?: AbortSignal) => Promise<string>;
    generateNext: (prompt: string, index: number, frameCount: number, previous: Frame, signal?: AbortSignal) => Promise<string>;
    render: (svg: string) => Buffer;
    encode: (video: Video, signal?: AbortSignal) => Promise<void>;
    retryDelayMs: number;
};
