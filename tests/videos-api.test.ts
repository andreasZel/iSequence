import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import express from 'express';
import { createVideoJobs } from '../server/jobs/videoJobs';
import { createVideosRouter } from '../server/routes/videos';
import { createVideo, getVideo, updateVideo, videoDir } from '../server/store/videos';
import type { Video, VideoStreamEvent } from '../server/types';

const dir = mkdtempSync(path.join(tmpdir(), 'isequence-videos-api-'));
process.env.DATA_DIR = dir;
process.env.FRAME_COUNT = '3';

let gate: Promise<void> = Promise.resolve();
let failure: Error | null = null;
const encoded: string[] = [];

const jobs = createVideoJobs({
    generateFirst: async () => 'svg-1',
    generateNext: async (_prompt, index, _frameCount, _previous, signal) => {
        await Promise.race([gate, new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))))]);
        if (failure) throw failure;
        return `svg-${index}`;
    },
    render: (svg) => Buffer.from(svg),
    encode: async (video) => void encoded.push(`${video.name}:${video.frameCount}`),
    retryDelayMs: 0
});

const app = express();
app.use(express.json());
app.use('/api/videos', createVideosRouter(jobs));
const server = app.listen(0);
const base = () => `http://localhost:${(server.address() as AddressInfo).port}/api/videos`;
const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

after(() => {
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
});

function hold() {
    let release = () => {};
    gate = new Promise((resolve) => {
        release = resolve;
    });
    return release;
}

async function readEvents(id: string, isLast: (event: VideoStreamEvent) => boolean) {
    const controller = new AbortController();
    const response = await fetch(`${base()}/${id}/events`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    const events: VideoStreamEvent[] = [];
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body!) {
        buffer += decoder.decode(chunk, { stream: true });
        for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
            const data = buffer.slice(0, end).split('\n').find((line) => line.startsWith('data: '));
            buffer = buffer.slice(end + 2);
            if (data) events.push(JSON.parse(data.slice(6)));
        }
        if (events.some(isLast)) break;
    }
    controller.abort();
    return events;
}

test('creates a video, runs it and serves it', async () => {
    const created = await post(base(), { name: '  My reel ', prompt: ' waves ' });
    assert.equal(created.status, 201);
    const video = await created.json() as Video;
    assert.deepEqual([video.name, video.prompt, video.frameCount, video.status], ['My reel', 'waves', 3, 'queued']);
    await jobs.whenIdle();

    const stored = await (await fetch(`${base()}/${video.id}`)).json() as Video;
    assert.deepEqual([stored.status, stored.framesDone], ['done', 3]);
    const list = await (await fetch(base())).json() as Video[];
    assert.ok(list.some((item) => item.id === video.id));
});

test('rejects missing fields, bad ids and unknown videos', async () => {
    assert.equal((await post(base(), { prompt: 'no name' })).status, 400);
    assert.equal((await post(base(), { name: 'no prompt', prompt: '  ' })).status, 400);
    assert.equal((await post(base(), { name: 'x'.repeat(121), prompt: 'p' })).status, 400);
    assert.equal((await post(base(), { name: 'n', prompt: 'x'.repeat(2001) })).status, 400);
    assert.equal((await fetch(`${base()}/not-an-id`)).status, 400);
    const unknown = '00000000-0000-4000-8000-000000000000';
    assert.equal((await fetch(`${base()}/${unknown}`)).status, 404);
    assert.equal((await fetch(`${base()}/${unknown}/events`)).status, 404);
    assert.equal((await post(`${base()}/${unknown}/retry`)).status, 404);
});

test('the event stream sends a snapshot, then frames and statuses', async () => {
    const release = hold();
    const video = await (await post(base(), { name: 'Stream', prompt: 'stream' })).json() as Video;
    const reading = readEvents(video.id, (event) => event.type === 'status' && event.status === 'done');
    setTimeout(release, 50);
    const events = await reading;
    await jobs.whenIdle();

    const [first] = events;
    assert.equal(first.type, 'snapshot');
    assert.equal(first.type === 'snapshot' && first.video.id, video.id);
    const frames = events.flatMap((event) => event.type === 'frame' ? [event.index] : []);
    assert.deepEqual(frames.slice(-2), [2, 3]);
    const statuses = events.flatMap((event) => event.type === 'status' ? [event.status] : []);
    assert.deepEqual(statuses.slice(-2), ['encoding', 'done']);
});

test('a failed video reports the error and can be retried', async () => {
    const release = hold();
    failure = new Error('claude is down');
    const video = await (await post(base(), { name: 'Retry', prompt: 'retry' })).json() as Video;
    const reading = readEvents(video.id, (event) => event.type === 'status' && event.status === 'failed');
    setTimeout(release, 50);
    const events = await reading;
    await jobs.whenIdle();
    assert.ok(events.some((event) => event.type === 'error' && event.message === 'claude is down'));
    const failed = await getVideo(video.id);
    assert.deepEqual([failed?.error, failed?.framesDone], ['claude is down', 1]);

    failure = null;
    const retried = await post(`${base()}/${video.id}/retry`);
    assert.equal(retried.status, 202);
    assert.equal((await retried.json() as Video).error, null);
    await jobs.whenIdle();
    const stored = await getVideo(video.id);
    assert.deepEqual([stored?.status, stored?.framesDone], ['done', 3]);
    assert.equal((await post(`${base()}/${video.id}/retry`)).status, 409);
});

test('deleting a running video cancels its job and removes its files', async () => {
    hold();
    const video = await (await post(base(), { name: 'Delete', prompt: 'delete' })).json() as Video;
    await readEvents(video.id, (event) => (event.type === 'frame' && event.index === 1) || (event.type === 'snapshot' && event.video.framesDone === 1));
    assert.equal(jobs.runningId(), video.id);

    assert.equal((await fetch(`${base()}/${video.id}`, { method: 'DELETE' })).status, 204);
    await jobs.whenIdle();
    assert.equal(existsSync(videoDir(video.id)), false);
    assert.equal((await fetch(`${base()}/${video.id}`)).status, 404);
    gate = Promise.resolve();
});

test('cancelling stops the running video and drops a queued one', async () => {
    const release = hold();
    const running = await (await post(base(), { name: 'Running', prompt: 'running' })).json() as Video;
    const queued = await (await post(base(), { name: 'Queued', prompt: 'queued' })).json() as Video;
    await readEvents(running.id, (event) => (event.type === 'frame' && event.index === 1) || (event.type === 'snapshot' && event.video.framesDone === 1));

    const dropped = await post(`${base()}/${queued.id}/cancel`);
    assert.equal(dropped.status, 200);
    assert.equal((await dropped.json() as Video).status, 'cancelled');

    const stopped = await post(`${base()}/${running.id}/cancel`);
    assert.equal(stopped.status, 200);
    assert.deepEqual([(await stopped.json() as Video).status, jobs.runningId()], ['cancelled', null]);
    assert.equal((await post(`${base()}/${running.id}/cancel`)).status, 409);
    await jobs.whenIdle();
    assert.deepEqual([(await getVideo(running.id))?.framesDone, (await getVideo(queued.id))?.framesDone], [1, 0]);

    release();
    assert.equal((await post(`${base()}/${running.id}/retry`)).status, 202);
    await jobs.whenIdle();
    assert.deepEqual([(await getVideo(running.id))?.status, (await getVideo(running.id))?.framesDone], ['done', 3]);
});

test('cancel rejects unknown and finished videos', async () => {
    assert.equal((await post(`${base()}/00000000-0000-4000-8000-000000000000/cancel`)).status, 404);
    const finished = await createVideo('Finished', 'finished', 2);
    await updateVideo(finished.id, { status: 'done' });
    const response = await post(`${base()}/${finished.id}/cancel`);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /done cannot be cancelled/);
});

test('a token inside an error never reaches the client', async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-secret-value';
    const release = hold();
    failure = new Error('request with sk-ant-oat01-secret-value was refused');
    const video = await (await post(base(), { name: 'Leak', prompt: 'leak' })).json() as Video;
    const reading = readEvents(video.id, (event) => event.type === 'status' && event.status === 'failed');
    setTimeout(release, 50);
    const events = await reading;
    await jobs.whenIdle();
    failure = null;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;

    const stored = await (await fetch(`${base()}/${video.id}`)).text();
    assert.ok(!JSON.stringify(events).includes('secret-value') && !stored.includes('secret-value'));
    assert.match(stored, /request with \[redacted\] was refused/);
});

test('a cancelled video can be retried, a running one cannot', async () => {
    const cancelled = await createVideo('Cancelled', 'cancelled', 2);
    await updateVideo(cancelled.id, { status: 'cancelled' });
    const release = hold();
    const retried = await post(`${base()}/${cancelled.id}/retry`);
    assert.equal(retried.status, 202);
    assert.equal((await post(`${base()}/${cancelled.id}/retry`)).status, 409);
    release();
    await jobs.whenIdle();
    assert.equal((await getVideo(cancelled.id))?.status, 'done');
});

test('the frame count can be chosen and falls back to FRAME_COUNT', async () => {
    const chosen = await post(base(), { name: 'Chosen', prompt: 'chosen', frameCount: 2 });
    assert.equal(chosen.status, 201);
    const video = await chosen.json() as Video;
    assert.equal(video.frameCount, 2);
    await jobs.whenIdle();
    assert.deepEqual([(await getVideo(video.id))?.status, (await getVideo(video.id))?.framesDone], ['done', 2]);
    assert.ok(encoded.includes('Chosen:2'));

    assert.equal((await (await post(base(), { name: 'Default', prompt: 'default' })).json() as Video).frameCount, 3);
    await jobs.whenIdle();
    for (const frameCount of [0, 61, 2.5, -1, '5', true]) {
        const response = await post(base(), { name: 'Bad', prompt: 'bad', frameCount });
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /frame count/);
    }
});

test('a cancelled video becomes a video of its saved frames', async () => {
    const release = hold();
    const video = await (await post(base(), { name: 'Short', prompt: 'short' })).json() as Video;
    await readEvents(video.id, (event) => (event.type === 'frame' && event.index === 1) || (event.type === 'snapshot' && event.video.framesDone === 1));
    assert.equal((await post(`${base()}/${video.id}/finish`)).status, 409);
    assert.equal((await post(`${base()}/${video.id}/cancel`)).status, 200);
    release();

    const finished = await post(`${base()}/${video.id}/finish`);
    assert.equal(finished.status, 202);
    assert.equal((await finished.json() as Video).frameCount, 1);
    await jobs.whenIdle();
    const stored = await getVideo(video.id);
    assert.deepEqual([stored?.status, stored?.frameCount, stored?.framesDone], ['done', 1, 1]);
    assert.ok(encoded.includes('Short:1'));
    assert.equal((await post(`${base()}/${video.id}/finish`)).status, 409);
});

test('finish refuses videos without frames and unknown videos', async () => {
    assert.equal((await post(`${base()}/00000000-0000-4000-8000-000000000000/finish`)).status, 404);
    const empty = await createVideo('Empty', 'empty', 3);
    await updateVideo(empty.id, { status: 'cancelled' });
    const response = await post(`${base()}/${empty.id}/finish`);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /no frames/);
    assert.equal((await getVideo(empty.id))?.frameCount, 3);
});
