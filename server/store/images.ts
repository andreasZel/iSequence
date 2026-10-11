import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageItem } from '../types';
import { assertValidId, imagesDir } from './paths';

export function imagePath(id: string, extension: 'svg' | 'png' | 'json') {
    assertValidId(id);
    return path.join(imagesDir(), `${id}.${extension}`);
}

export async function createImage(prompt: string, svg: string, png: Buffer) {
    const image: ImageItem = { id: randomUUID(), prompt, createdAt: new Date().toISOString() };
    await mkdir(imagesDir(), { recursive: true });
    await writeFile(imagePath(image.id, 'svg'), svg, 'utf8');
    await writeFile(imagePath(image.id, 'png'), png);
    await writeFile(imagePath(image.id, 'json'), JSON.stringify(image, null, 2), 'utf8');
    return image;
}

export async function listImages() {
    if (!existsSync(imagesDir())) return [];
    const files = (await readdir(imagesDir())).filter((file) => file.endsWith('.json'));
    const images = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(imagesDir(), file), 'utf8')) as ImageItem));
    return images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteImage(id: string) {
    await Promise.all((['svg', 'png', 'json'] as const).map((extension) => rm(imagePath(id, extension), { force: true })));
}
