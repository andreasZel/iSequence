import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../../server/types';
import { cancelVideo, fetchVideos, finishVideo, isActive, removeVideo, retryVideo } from '../api/videos';
import { LoadError } from '../components/LoadError';
import { VideoCard } from '../components/VideoCard';

const REFRESH_MS = 3000;

export const VideosPage = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadKey, setLoadKey] = useState(0);
    const [stale, setStale] = useState(false);
    const [busyIds, setBusyIds] = useState<string[]>([]);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasActive = videos.some((video) => isActive(video.status));

    useEffect(() => {
        let active = true;
        fetchVideos()
            .then((items) => active && setVideos(items))
            .catch((reason: Error) => active && setLoadError(reason.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [loadKey]);

    useEffect(() => {
        if (!hasActive) return;
        let active = true;
        const timer = setInterval(() => {
            fetchVideos()
                .then((items) => {
                    if (!active) return;
                    setVideos(items);
                    setStale(false);
                })
                .catch(() => active && setStale(true));
        }, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [hasActive]);

    const handleReload = () => {
        setLoading(true);
        setLoadError(null);
        setLoadKey((current) => current + 1);
    };

    const handleChange = async (id: string, change: (id: string) => Promise<Video>, fallback: string) => {
        setBusyIds((current) => [...current, id]);
        setError(null);
        try {
            const changed = await change(id);
            setVideos((current) => current.map((video) => video.id === id ? changed : video));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : fallback);
        } finally {
            setBusyIds((current) => current.filter((item) => item !== id));
        }
    };

    const handleDelete = async (video: Video) => {
        if (!window.confirm(`Delete "${video.name}"?`)) return;
        setBusyIds((current) => [...current, video.id]);
        setError(null);
        try {
            await removeVideo(video.id);
            setVideos((current) => current.filter((item) => item.id !== video.id));
            setPlayingId((current) => current === video.id ? null : current);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The video could not be deleted');
        } finally {
            setBusyIds((current) => current.filter((item) => item !== video.id));
        }
    };

    return (
        <section className="page">
            <h1 className="page__title">Videos</h1>
            <p className="page__hint">Every video you have made, newest first.</p>

            {loadError && <LoadError message={loadError} onRetry={handleReload} />}
            {error && <p className="alert alert--spaced" role="alert">{error}</p>}
            {stale && hasActive && <p className="notice notice--spaced" role="status">Connection lost, the list may be out of date. Trying again…</p>}

            {loading && <p className="page__hint page__hint--spaced" role="status">Loading videos…</p>}
            {!loading && !loadError && videos.length === 0 && <p className="page__hint page__hint--spaced">No videos yet. <Link className="page__link" to="/" state={{ fresh: true }}>Create your first one.</Link></p>}

            <ul className="gallery">
                {videos.map((video) => (
                    <VideoCard key={video.id} video={video} playing={playingId === video.id} busy={busyIds.includes(video.id)} onPlay={setPlayingId} onRetry={(id) => handleChange(id, retryVideo, 'The video could not be retried')} onFinish={(id) => handleChange(id, finishVideo, 'The video could not be finished')} onCancel={(id) => handleChange(id, cancelVideo, 'The video could not be cancelled')} onDelete={handleDelete} />
                ))}
            </ul>
        </section>
    );
};
