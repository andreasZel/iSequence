import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Frame, Video, VideoPatch } from '../types';
import { assertValidId, isValidId, videosDir } from './paths';

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
    await writeMeta(video);
    return video;
}

export async function getVideo(id: string) {
    if (!isValidId(id)) return null;
    try {
        return JSON.parse(await readFile(metaPath(id), 'utf8')) as Video;
    } catch {
        return null;
    }
}

export async function updateVideo(id: string, patch: VideoPatch) {
    const video = await getVideo(id);
    if (!video) throw new Error(`Video not found: ${id}`);
    const updated: Video = { ...video, ...patch, updatedAt: new Date().toISOString() };
    await writeMeta(updated);
    return updated;
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

async function writeMeta(video: Video) {
    const target = metaPath(video.id);
    await writeFile(`${target}.tmp`, JSON.stringify(video, null, 2), 'utf8');
    await rename(`${target}.tmp`, target);
}
