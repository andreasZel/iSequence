import type { Video, VideoStatus, VideoStreamEvent } from '../../server/types';
import { request } from './http';

const STREAM_EVENTS = ['snapshot', 'frame', 'status', 'error'];
const ACTIVE: VideoStatus[] = ['queued', 'generating', 'encoding'];

export function isActive(status: VideoStatus) {
    return ACTIVE.includes(status);
}

export function frameUrl(id: string, index: number) {
    return `/media/videos/${id}/frames/${String(index).padStart(3, '0')}.png`;
}

export function videoUrl(id: string) {
    return `/media/videos/${id}/output.mp4`;
}

export function downloadName(name: string) {
    return `${name.replace(/[^\w-]+/g, '-')}.mp4`;
}

export async function fetchVideos() {
    const response = await request('/api/videos');
    return await response.json() as Video[];
}

export async function fetchVideo(id: string) {
    const response = await request(`/api/videos/${id}`);
    return await response.json() as Video;
}

export async function fetchDefaultFrameCount() {
    const response = await request('/api/health');
    return (await response.json() as { frameCount: number }).frameCount;
}

export async function createVideo(name: string, prompt: string, frameCount: number) {
    const response = await request('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, prompt, frameCount }) });
    return await response.json() as Video;
}

export async function retryVideo(id: string) {
    const response = await request(`/api/videos/${id}/retry`, { method: 'POST' });
    return await response.json() as Video;
}

export async function finishVideo(id: string) {
    const response = await request(`/api/videos/${id}/finish`, { method: 'POST' });
    return await response.json() as Video;
}

export async function cancelVideo(id: string) {
    const response = await request(`/api/videos/${id}/cancel`, { method: 'POST' });
    return await response.json() as Video;
}

export async function removeVideo(id: string) {
    await request(`/api/videos/${id}`, { method: 'DELETE' });
}

export function watchVideo(id: string, onEvent: (event: VideoStreamEvent) => void, onInterrupted: () => void, onClosed: () => void) {
    const source = new EventSource(`/api/videos/${id}/events`);
    const handleMessage = (message: Event) => {
        if (message instanceof MessageEvent) return onEvent(JSON.parse(message.data) as VideoStreamEvent);
        // A plain error event with a closed stream means no reconnect.
        if (source.readyState === EventSource.CLOSED) onClosed();
        else onInterrupted();
    };
    for (const type of STREAM_EVENTS) source.addEventListener(type, handleMessage);
    return () => source.close();
}
