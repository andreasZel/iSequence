import path from 'node:path';

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function dataDir() {
    return path.resolve(process.env.DATA_DIR ?? 'data');
}

export function videosDir() {
    return path.join(dataDir(), 'videos');
}

export function imagesDir() {
    return path.join(dataDir(), 'images');
}

export function isValidId(id: string) {
    return ID_PATTERN.test(id);
}

export function assertValidId(id: string) {
    if (!isValidId(id)) throw new Error(`Invalid id: ${id}`);
}
