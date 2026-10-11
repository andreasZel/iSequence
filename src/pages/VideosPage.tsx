import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../../server/types';
import { fetchVideos, isActive, removeVideo, retryVideo } from '../api/videos';
import { VideoCard } from '../components/VideoCard';

const REFRESH_MS = 3000;

export const VideosPage = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyIds, setBusyIds] = useState<string[]>([]);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasActive = videos.some((video) => isActive(video.status));

    useEffect(() => {
        let active = true;
        fetchVideos()
            .then((items) => active && setVideos(items))
            .catch((reason: Error) => active && setError(reason.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!hasActive) return;
        let active = true;
        const timer = setInterval(() => {
            fetchVideos()
                .then((items) => active && setVideos(items))
                .catch(() => undefined);
        }, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [hasActive]);

    const handleRetry = async (id: string) => {
        setBusyIds((current) => [...current, id]);
        setError(null);
        try {
            const retried = await retryVideo(id);
            setVideos((current) => current.map((video) => video.id === id ? retried : video));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The video could not be retried');
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

            {error && <p className="alert alert--spaced" role="alert">{error}</p>}

            {loading && <p className="page__hint page__hint--spaced">Loading videos…</p>}
            {!loading && !error && videos.length === 0 && <p className="page__hint page__hint--spaced">No videos yet. <Link className="page__link" to="/" state={{ fresh: true }}>Create your first one.</Link></p>}

            <ul className="gallery">
                {videos.map((video) => (
                    <VideoCard key={video.id} video={video} playing={playingId === video.id} busy={busyIds.includes(video.id)} onPlay={setPlayingId} onRetry={handleRetry} onDelete={handleDelete} />
                ))}
            </ul>
        </section>
    );
};
