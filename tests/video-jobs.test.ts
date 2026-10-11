import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ClaudeConfigError } from '../server/claude/client';
import { createVideoJobs, resolveFrameCount } from '../server/jobs/videoJobs';
import type { VideoJobDeps } from '../server/jobs/videoJobs';
import { countSavedFrames, createVideo, getVideo, readFrame, saveFrame, updateVideo } from '../server/store/videos';
import type { VideoEvent } from '../server/types';

const dir = mkdtempSync(path.join(tmpdir(), 'isequence-jobs-'));
process.env.DATA_DIR = dir;

after(() => rmSync(dir, { recursive: true, force: true }));

function fakeDeps(log: string[], overrides: Partial<VideoJobDeps> = {}): Partial<VideoJobDeps> {
    return {
        generateFirst: async (prompt) => {
            log.push(`${prompt}:1`);
            return 'svg-1';
        },
        generateNext: async (prompt, index, _frameCount, previous) => {
            log.push(`${prompt}:${index}<-${previous.index}:${previous.svg}:${previous.png.toString()}`);
            return `svg-${index}`;
        },
        render: (svg) => Buffer.from(`png-of-${svg}`),
        encode: async (video) => void log.push(`${video.prompt}:encode`),
        retryDelayMs: 0,
        ...overrides
    };
}

test('each frame is generated from the saved previous frame only', async () => {
    const log: string[] = [];
    const events: VideoEvent[] = [];
    const jobs = createVideoJobs(fakeDeps(log));
    jobs.subscribe((event) => events.push(event));
    const video = await createVideo('Chain', 'chain', 3);
    await jobs.enqueue(video.id);
    await jobs.whenIdle();

    assert.deepEqual(log, ['chain:1', 'chain:2<-1:svg-1:png-of-svg-1', 'chain:3<-2:svg-2:png-of-svg-2', 'chain:encode']);
    const stored = await getVideo(video.id);
    assert.equal(stored?.status, 'done');
    assert.equal(stored?.framesDone, 3);
    assert.equal((await readFrame(video.id, 3)).svg, 'svg-3');
    assert.deepEqual(events.filter((event) => event.type === 'frame').map((event) => event.index), [1, 2, 3]);
    assert.deepEqual(events.filter((event) => event.type === 'status').map((event) => event.status), ['generating', 'encoding', 'done']);
});

test('a frame is tried three times, then the job fails', async () => {
    const log: string[] = [];
    let failures = 2;
    const flaky = createVideoJobs(fakeDeps(log, {
        render: (svg) => {
            if (svg === 'svg-2' && failures-- > 0) throw new Error('bad frame');
            return Buffer.from(svg);
        }
    }));
    const recovered = await createVideo('Flaky', 'flaky', 2);
    await flaky.enqueue(recovered.id);
    await flaky.whenIdle();
    assert.equal((await getVideo(recovered.id))?.status, 'done');
    assert.equal(log.filter((entry) => entry.startsWith('flaky:2')).length, 3);

    const broken = createVideoJobs(fakeDeps(log, {
        generateNext: async (prompt) => {
            log.push(`${prompt}:attempt`);
            throw new Error('claude is down');
        }
    }));
    const failed = await createVideo('Broken', 'broken', 3);
    await broken.enqueue(failed.id);
    await broken.whenIdle();
    const stored = await getVideo(failed.id);
    assert.equal(stored?.status, 'failed');
    assert.equal(stored?.error, 'claude is down');
    assert.equal(stored?.framesDone, 1);
    assert.equal(log.filter((entry) => entry === 'broken:attempt').length, 3);
});

test('a missing token fails at once without retries', async () => {
    let calls = 0;
    const jobs = createVideoJobs(fakeDeps([], {
        generateFirst: async () => {
            calls++;
            throw new ClaudeConfigError('token missing');
        }
    }));
    const video = await createVideo('Config', 'config', 2);
    await jobs.enqueue(video.id);
    await jobs.whenIdle();
    assert.equal(calls, 1);
    assert.equal((await getVideo(video.id))?.error, 'token missing');
});

test('one job runs at a time and the rest wait in order', async () => {
    const log: string[] = [];
    let concurrent = 0;
    let peak = 0;
    const jobs = createVideoJobs(fakeDeps(log, {
        generateFirst: async (prompt) => {
            peak = Math.max(peak, ++concurrent);
            await new Promise((resolve) => setTimeout(resolve, 5));
            concurrent--;
            log.push(`${prompt}:1`);
            return 'svg-1';
        }
    }));
    const first = await createVideo('A', 'a', 1);
    const second = await createVideo('B', 'b', 1);
    const third = await createVideo('C', 'c', 1);
    await Promise.all([jobs.enqueue(first.id), jobs.enqueue(second.id), jobs.enqueue(third.id), jobs.enqueue(first.id)]);
    await jobs.cancel(third.id);
    await jobs.whenIdle();

    assert.equal(peak, 1);
    assert.deepEqual(log, ['a:1', 'a:encode', 'b:1', 'b:encode']);
    assert.equal((await getVideo(third.id))?.status, 'cancelled');
});

test('interrupted jobs resume from the last saved frame', async () => {
    const log: string[] = [];
    const interrupted = await createVideo('Resume', 'resume', 4);
    await saveFrame(interrupted.id, { index: 1, svg: 'old-1', png: Buffer.from('old-png-1') });
    await saveFrame(interrupted.id, { index: 2, svg: 'old-2', png: Buffer.from('old-png-2') });
    await updateVideo(interrupted.id, { status: 'generating', framesDone: 1 });
    const waiting = await createVideo('Waiting', 'waiting', 1);
    const finished = await createVideo('Finished', 'finished', 1);
    await updateVideo(finished.id, { status: 'failed' });

    const jobs = createVideoJobs(fakeDeps(log));
    await jobs.resume();
    await jobs.whenIdle();

    const resumed = log.filter((entry) => entry.startsWith('resume') || entry.startsWith('waiting') || entry.startsWith('finished'));
    assert.deepEqual(resumed, ['resume:3<-2:old-2:old-png-2', 'resume:4<-3:svg-3:png-of-svg-3', 'resume:encode', 'waiting:1', 'waiting:encode']);
    assert.equal((await getVideo(interrupted.id))?.status, 'done');
    assert.equal(await countSavedFrames(interrupted.id, 4), 4);
    assert.equal((await getVideo(finished.id))?.status, 'failed');
});

test('cancelling a running job stops it', async () => {
    const jobs = createVideoJobs(fakeDeps([], {
        generateNext: (_prompt, _index, _frameCount, _previous, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
        retryDelayMs: 0
    }));
    const video = await createVideo('Cancel', 'cancel', 3);
    jobs.subscribe((event) => event.type === 'frame' && void jobs.cancel(video.id));
    await jobs.enqueue(video.id);
    await jobs.whenIdle();
    const stored = await getVideo(video.id);
    assert.equal(stored?.status, 'cancelled');
    assert.equal(stored?.framesDone, 1);
});

test('FRAME_COUNT overrides the default of 60', () => {
    const saved = process.env.FRAME_COUNT;
    delete process.env.FRAME_COUNT;
    assert.equal(resolveFrameCount(), 60);
    process.env.FRAME_COUNT = '4';
    assert.equal(resolveFrameCount(), 4);
    process.env.FRAME_COUNT = 'lots';
    assert.equal(resolveFrameCount(), 60);
    if (saved === undefined) delete process.env.FRAME_COUNT;
    else process.env.FRAME_COUNT = saved;
});
