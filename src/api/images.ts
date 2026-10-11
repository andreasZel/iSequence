import type { ImageItem } from '../../server/types';
import { request } from './http';

export function imageUrl(id: string) {
    return `/media/images/${id}.png`;
}

export async function fetchImages() {
    const response = await request('/api/images');
    return await response.json() as ImageItem[];
}

export async function generateImage(prompt: string) {
    const response = await request('/api/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    return await response.json() as ImageItem;
}

export async function removeImage(id: string) {
    await request(`/api/images/${id}`, { method: 'DELETE' });
}
