import { spawn } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../claude/prompts';
import { countSavedFrames, outputPath, videoDir } from '../store/videos';
import type { Video } from '../types';

export const OUTPUT_FPS = 30;
export const SECONDS_PER_FRAME = 1;

const FRAME_PATTERN = 'frames/%03d.png';
const TEMP_OUTPUT = 'output.tmp.mp4';
const STDERR_LIMIT = 4000;

export class VideoEncodeError extends Error {
    name = 'VideoEncodeError';
}

export function ffmpegBinary() {
    if (!ffmpegPath) throw new VideoEncodeError('ffmpeg is not available on this platform');
    return ffmpegPath;
}

// scene=100 disables scene detection so every pair of frames is blended.
export function buildEncodeArgs(frameCount: number) {
    const filters = [
        `tpad=stop_mode=clone:stop_duration=${SECONDS_PER_FRAME}`,
        `framerate=fps=${OUTPUT_FPS}:interp_start=0:interp_end=255:scene=100`,
        `scale=${FRAME_WIDTH}:${FRAME_HEIGHT}`,
        'setsar=1',
        'format=yuv420p'
    ];
    return [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-framerate', `1/${SECONDS_PER_FRAME}`, '-start_number', '1', '-i', FRAME_PATTERN,
        '-vf', filters.join(','),
        '-frames:v', String(frameCount * SECONDS_PER_FRAME * OUTPUT_FPS),
        '-r', String(OUTPUT_FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', '-an', TEMP_OUTPUT
    ];
}

export function runFfmpeg(args: string[], cwd: string, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegBinary(), args, { cwd, signal, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk: Buffer) => {
            stderr = (stderr + chunk.toString()).slice(-STDERR_LIMIT);
        });
        let failure: Error | null = null;
        child.on('error', (error) => {
            failure = signal?.aborted ? error : new VideoEncodeError(`ffmpeg could not run: ${error.message}`);
            if (child.pid === undefined) reject(failure);
        });
        child.on('close', (code) => {
            if (failure) return void reject(failure);
            if (code === 0) return void resolve();
            reject(new VideoEncodeError(`ffmpeg exited with code ${code}: ${stderr.trim() || 'no output'}`));
        });
    });
}

export async function encodeVideo(video: Video, signal?: AbortSignal) {
    const saved = await countSavedFrames(video.id, video.frameCount);
    if (saved < video.frameCount) throw new VideoEncodeError(`Only ${saved} of ${video.frameCount} frames are saved`);
    const cwd = videoDir(video.id);
    const temp = path.join(cwd, TEMP_OUTPUT);
    try {
        await runFfmpeg(buildEncodeArgs(video.frameCount), cwd, signal);
        await rename(temp, outputPath(video.id));
    } catch (error) {
        await rm(temp, { force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
        throw error;
    }
}
