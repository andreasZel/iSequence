import { useEffect, useState } from 'react';
import type { Video, VideoStreamEvent } from '../../server/types';
import { ApiError } from '../api/http';
import { cancelVideo, fetchVideo, isActive, retryVideo, watchVideo } from '../api/videos';

const RECONNECT_MS = 3000;

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
    const [reconnecting, setReconnecting] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [pending, setPending] = useState<VideoAction | null>(null);
    const finished = video !== null && !isActive(video.status);

    useEffect(() => {
        if (finished) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const reopen = () => {
            timer = setTimeout(() => setAttempt((current) => current + 1), RECONNECT_MS);
        };
        const handleEvent = (event: VideoStreamEvent) => {
            setReconnecting(false);
            setVideo((current) => applyEvent(current, event));
        };
        const handleClosed = () => {
            fetchVideo(id)
                .then((latest) => {
                    if (!active) return;
                    setVideo(latest);
                    setReconnecting(false);
                    reopen();
                })
                .catch((reason: Error) => {
                    if (!active) return;
                    if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500) return setError(reason.message);
                    setReconnecting(true);
                    reopen();
                });
        };
        const close = watchVideo(id, handleEvent, () => setReconnecting(true), handleClosed);
        return () => {
            active = false;
            clearTimeout(timer);
            close();
        };
    }, [id, finished, attempt]);

    const act = async (action: VideoAction) => {
        setPending(action);
        setError(null);
        try {
            setVideo(action === 'retry' ? await retryVideo(id) : await cancelVideo(id));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : `The video could not be ${action === 'retry' ? 'retried' : 'cancelled'}`);
        } finally {
            setPending(null);
        }
    };

    return { video, error, reconnecting: reconnecting && !finished, pending, retry: () => act('retry'), cancel: () => act('cancel') };
}

type VideoAction = 'retry' | 'cancel';
