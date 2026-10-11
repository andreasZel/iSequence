import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { fetchVideos } from '../api/videos';
import { VideoForm } from '../components/VideoForm';
import { VideoProgress } from '../components/VideoProgress';

export const CreateVideoPage = () => {
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const [checkedKey, setCheckedKey] = useState<string | null>(null);
    const videoId = params.get('video');
    const fresh = Boolean((location.state as CreateLocationState)?.fresh);
    const checking = !videoId && !fresh && checkedKey !== location.key;

    useEffect(() => {
        if (!checking) return;
        let active = true;
        // Reattach to the running job, or the oldest queued one.
        fetchVideos()
            .then((videos) => {
                const running = videos.find((video) => video.status === 'generating' || video.status === 'encoding') ?? videos.filter((video) => video.status === 'queued').at(-1);
                if (active && running) setParams({ video: running.id }, { replace: true });
            })
            .catch(() => undefined)
            .finally(() => active && setCheckedKey(location.key));
        return () => {
            active = false;
        };
    }, [checking, location.key, setParams]);

    return (
        <section className="page">
            <h1 className="page__title">Create a video</h1>
            {!videoId && <p className="page__hint">Name your video and describe it. Claude draws one frame per second of video, up to 60, each one from the frame before it.</p>}
            {checking && <p className="page__hint">Looking for a running video…</p>}
            {!videoId && !checking && <VideoForm onCreated={(video) => setParams({ video: video.id })} />}
            {videoId && <VideoProgress key={videoId} videoId={videoId} />}
        </section>
    );
};

type CreateLocationState = { fresh?: boolean } | null;
