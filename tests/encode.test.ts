import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createVideoJobs } from '../server/jobs/videoJobs';
import { VideoEncodeError, buildEncodeArgs, encodeVideo, ffmpegBinary } from '../server/render/encode';
import { svgToPng } from '../server/render/svgToPng';
import { createVideo, getVideo, outputPath, saveFrame, videoDir } from '../server/store/videos';

const dir = mkdtempSync(path.join(tmpdir(), 'isequence-encode-'));
process.env.DATA_DIR = dir;

after(() => rmSync(dir, { recursive: true, force: true }));

const COLORS = ['#ff0000', '#0000ff', '#00ff00'];

function solid(color: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${color}"/></svg>`;
}

async function videoWithFrames(name: string, frameCount: number, saved = frameCount) {
    const video = await createVideo(name, name, frameCount);
    for (let index = 1; index <= saved; index++) {
        const svg = solid(COLORS[(index - 1) % COLORS.length]);
        await saveFrame(video.id, { index, svg, png: svgToPng(svg) });
    }
    return video;
}

function probe(file: string) {
    return spawnSync(ffmpegBinary(), ['-hide_banner', '-i', file, '-map', '0:v', '-c', 'copy', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
}

function pixelAt(file: string, seconds: number) {
    const args = ['-hide_banner', '-loglevel', 'error', '-ss', String(seconds), '-i', file, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'];
    return [...spawnSync(ffmpegBinary(), args).stdout];
}

test('the reel arguments ask for 60 seconds at 30 fps', () => {
    const args = buildEncodeArgs(60);
    assert.equal(args[args.indexOf('-frames:v') + 1], '1800');
    assert.equal(args[args.indexOf('-c:v') + 1], 'libx264');
    assert.equal(args[args.indexOf('-pix_fmt') + 1], 'yuv420p');
    assert.match(args[args.indexOf('-vf') + 1], /framerate=fps=30.*scale=1080:1920/);
});

test('frames become a 1080×1920 H.264 yuv420p MP4, one second each', async () => {
    const video = await videoWithFrames('Encode', 3);
    await encodeVideo(video);

    const info = probe(outputPath(video.id));
    assert.match(info, /Video: h264/);
    assert.match(info, /yuv420p/);
    assert.match(info, /1080x1920/);
    assert.match(info, /\b30 fps/);
    assert.match(info, /Duration: 00:00:03\.00/);
    assert.equal(existsSync(path.join(videoDir(video.id), 'output.tmp.mp4')), false);
});

test('neighbouring frames are blended into each other', async () => {
    const video = await videoWithFrames('Blend', 2);
    await encodeVideo(video);

    const [startRed, , startBlue] = pixelAt(outputPath(video.id), 0);
    assert.ok(startRed > 200 && startBlue < 60, `start ${startRed},${startBlue}`);
    const [midRed, , midBlue] = pixelAt(outputPath(video.id), 0.5);
    assert.ok(midRed > 60 && midRed < 200 && midBlue > 60 && midBlue < 200, `middle ${midRed},${midBlue}`);
    const [endRed, , endBlue] = pixelAt(outputPath(video.id), 1.5);
    assert.ok(endRed < 60 && endBlue > 200, `end ${endRed},${endBlue}`);
});

test('missing or unreadable frames surface an encode error', async () => {
    const short = await videoWithFrames('Short', 3, 2);
    await assert.rejects(encodeVideo(short), /Only 2 of 3 frames/);

    const broken = await createVideo('Broken', 'broken', 1);
    await saveFrame(broken.id, { index: 1, svg: 'svg', png: Buffer.from('not a png') });
    await assert.rejects(encodeVideo(broken), VideoEncodeError);
    assert.equal(existsSync(outputPath(broken.id)), false);
});

test('an aborted encode leaves no output behind', async () => {
    const video = await videoWithFrames('Abort', 3);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(encodeVideo(video, controller.signal), { name: 'AbortError' });
    assert.equal(existsSync(outputPath(video.id)), false);
    assert.equal(existsSync(path.join(videoDir(video.id), 'output.tmp.mp4')), false);
});

test('the job encodes after the last frame and ends as done', async () => {
    const jobs = createVideoJobs({ generateFirst: async () => solid(COLORS[0]), generateNext: async (_prompt, index) => solid(COLORS[(index - 1) % COLORS.length]), retryDelayMs: 0 });
    const video = await createVideo('Job', 'job', 2);
    await jobs.enqueue(video.id);
    await jobs.whenIdle();

    const stored = await getVideo(video.id);
    assert.equal(stored?.error, null);
    assert.equal(stored?.status, 'done');
    assert.match(probe(outputPath(video.id)), /Duration: 00:00:02\.00/);
});
