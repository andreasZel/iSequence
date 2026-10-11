import { useEffect, useState } from 'react';
import type { Video, VideoStreamEvent } from '../../server/types';
import { fetchVideo, isActive, retryVideo, watchVideo } from '../api/videos';

function applyEvent(video: Video | null, event: VideoStreamEvent) {
    if (event.type === 'snapshot') return event.video;
    if (!video) return video;
    if (event.type === 'frame') return { ...video, framesDone: Math.max(video.framesDone, event.index) };
    if (event.type === 'error') return { ...video, error: event.message };
    return { ...video, status: event.status, error: event.status === 'failed' ? video.error : null };
}

export function useVideoStream(id: string) {
    const [video, setVideo] = useState<Video | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const finished = video !== null && !isActive(video.status);

    useEffect(() => {
        if (finished) return;
        let active = true;
        const handleClosed = () => {
            fetchVideo(id)
                .then((latest) => active && setVideo(latest))
                .catch((reason: Error) => active && setError(reason.message));
        };
        const close = watchVideo(id, (event) => setVideo((current) => applyEvent(current, event)), handleClosed);
        return () => {
            active = false;
            close();
        };
    }, [id, finished]);

    const retry = async () => {
        setRetrying(true);
        setError(null);
        try {
            setVideo(await retryVideo(id));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The video could not be retried');
        } finally {
            setRetrying(false);
        }
    };

    return { video, error, retrying, retry };
}
