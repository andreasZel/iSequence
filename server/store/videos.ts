import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Frame, Video, VideoPatch } from '../types';
import { assertValidId, isValidId, videosDir } from './paths';

const BUSY_CODES = ['EPERM', 'EBUSY', 'EACCES'];
const BUSY_ATTEMPTS = 20;
const metaLocks = new Map<string, Promise<void>>();

export function videoDir(id: string) {
    assertValidId(id);
    return path.join(videosDir(), id);
}

export function framePath(id: string, index: number, extension: 'svg' | 'png') {
    return path.join(videoDir(id), 'frames', `${String(index).padStart(3, '0')}.${extension}`);
}

export function outputPath(id: string) {
    return path.join(videoDir(id), 'output.mp4');
}

export async function createVideo(name: string, prompt: string, frameCount: number) {
    const now = new Date().toISOString();
    const video: Video = { id: randomUUID(), name, prompt, status: 'queued', frameCount, framesDone: 0, error: null, createdAt: now, updatedAt: now };
    await mkdir(path.join(videoDir(video.id), 'frames'), { recursive: true });
    await withMetaLock(video.id, () => writeMeta(video));
    return video;
}

export async function getVideo(id: string) {
    if (!isValidId(id)) return null;
    return await withMetaLock(id, () => readMeta(id));
}

export async function updateVideo(id: string, patch: VideoPatch) {
    return await withMetaLock(id, async () => {
        const video = await readMeta(id);
        if (!video) throw new Error(`Video not found: ${id}`);
        const updated: Video = { ...video, ...patch, updatedAt: new Date().toISOString() };
        await writeMeta(updated);
        return updated;
    });
}

export async function listVideos() {
    if (!existsSync(videosDir())) return [];
    const ids = await readdir(videosDir());
    const videos = await Promise.all(ids.map((id) => getVideo(id)));
    return videos.filter((video): video is Video => video !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteVideo(id: string) {
    await rm(videoDir(id), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export async function saveFrame(id: string, frame: Frame) {
    await writeFile(framePath(id, frame.index, 'svg'), frame.svg, 'utf8');
    await writeFile(framePath(id, frame.index, 'png'), frame.png);
}

export async function readFrame(id: string, index: number) {
    const svg = await readFile(framePath(id, index, 'svg'), 'utf8');
    const png = await readFile(framePath(id, index, 'png'));
    return { index, svg, png } satisfies Frame;
}

// Counts consecutive complete frames, the resume point after a restart.
export async function countSavedFrames(id: string, frameCount: number) {
    let count = 0;
    while (count < frameCount && existsSync(framePath(id, count + 1, 'svg')) && existsSync(framePath(id, count + 1, 'png'))) count++;
    return count;
}

function metaPath(id: string) {
    return path.join(videoDir(id), 'meta.json');
}

// One meta read or write per video at a time.
function withMetaLock<T>(id: string, action: () => Promise<T>) {
    const result = (metaLocks.get(id) ?? Promise.resolve()).then(action);
    const tail = result.then(() => undefined, () => undefined);
    metaLocks.set(id, tail);
    void tail.then(() => metaLocks.get(id) === tail && metaLocks.delete(id));
    return result;
}

async function readMeta(id: string) {
    try {
        return JSON.parse(await whenFree(() => readFile(metaPath(id), 'utf8'))) as Video;
    } catch {
        return null;
    }
}

async function writeMeta(video: Video) {
    const target = metaPath(video.id);
    await writeFile(`${target}.tmp`, JSON.stringify(video, null, 2), 'utf8');
    await whenFree(() => rename(`${target}.tmp`, target));
}

// Windows refuses to replace or open a file held elsewhere.
async function whenFree<T>(action: () => Promise<T>) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await action();
        } catch (error) {
            if (attempt === BUSY_ATTEMPTS || !BUSY_CODES.includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
            await delay(attempt * 5);
        }
    }
}
