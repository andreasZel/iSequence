import type { ImageItem } from '../../server/types';

async function readError(response: Response) {
    const body = await response.json().catch(() => null);
    return new Error(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`);
}

export function imageUrl(id: string) {
    return `/media/images/${id}.png`;
}

export async function fetchImages() {
    const response = await fetch('/api/images');
    if (!response.ok) throw await readError(response);
    return await response.json() as ImageItem[];
}

export async function generateImage(prompt: string) {
    const response = await fetch('/api/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    if (!response.ok) throw await readError(response);
    return await response.json() as ImageItem;
}

export async function removeImage(id: string) {
    const response = await fetch(`/api/images/${id}`, { method: 'DELETE' });
    if (!response.ok) throw await readError(response);
}
