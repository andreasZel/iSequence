import type { Video, VideoStatus, VideoStreamEvent } from '../../server/types';
import { readError } from './http';

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

export async function fetchVideos() {
    const response = await fetch('/api/videos');
    if (!response.ok) throw await readError(response);
    return await response.json() as Video[];
}

export async function fetchVideo(id: string) {
    const response = await fetch(`/api/videos/${id}`);
    if (!response.ok) throw await readError(response);
    return await response.json() as Video;
}

export async function createVideo(name: string, prompt: string) {
    const response = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, prompt }) });
    if (!response.ok) throw await readError(response);
    return await response.json() as Video;
}

export async function retryVideo(id: string) {
    const response = await fetch(`/api/videos/${id}/retry`, { method: 'POST' });
    if (!response.ok) throw await readError(response);
    return await response.json() as Video;
}

export function watchVideo(id: string, onEvent: (event: VideoStreamEvent) => void, onClosed: () => void) {
    const source = new EventSource(`/api/videos/${id}/events`);
    const handleMessage = (message: Event) => {
        if (message instanceof MessageEvent) return onEvent(JSON.parse(message.data) as VideoStreamEvent);
        // A plain error event with a closed stream means no reconnect.
        if (source.readyState === EventSource.CLOSED) onClosed();
    };
    for (const type of STREAM_EVENTS) source.addEventListener(type, handleMessage);
    return () => source.close();
}
