import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { VideoStatus } from '../../server/types';
import { downloadName, frameUrl, isActive, videoUrl } from '../api/videos';
import { useVideoStream } from '../hooks/useVideoStream';
import { Filmstrip } from './Filmstrip';

const STATUS_LABELS: Record<VideoStatus, string> = {
    queued: 'Waiting in the queue',
    generating: 'Generating frames',
    encoding: 'Assembling the video',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled'
};

export const VideoProgress = ({ videoId }: VideoProgressProps) => {
    const { video, error, retrying, retry } = useVideoStream(videoId);
    const [selected, setSelected] = useState<number | null>(null);

    if (!video) {
        return (
            <div className="progress">
                {error ? <p className="alert" role="alert">{error}</p> : <p className="page__hint">Loading the video…</p>}
                {error && <Link className="button" to="/" state={{ fresh: true }}>New video</Link>}
            </div>
        );
    }

    const current = selected ?? video.framesDone;
    const stopped = video.status === 'failed' || video.status === 'cancelled';

    return (
        <div className="progress">
            <div className="progress__stage">
                {video.status === 'done' && <video className="progress__screen" src={videoUrl(video.id)} poster={frameUrl(video.id, 1)} controls playsInline />}
                {video.status !== 'done' && current > 0 && <img className="progress__screen" src={frameUrl(video.id, current)} alt={`Frame ${current} of ${video.name}`} />}
                {video.status !== 'done' && current === 0 && <div className={`progress__screen progress__screen--empty${isActive(video.status) ? ' progress__screen--pending' : ''}`}>No frames yet</div>}
            </div>

            <div className="progress__details">
                <h2 className="progress__name">{video.name}</h2>
                <p className="progress__prompt">{video.prompt}</p>

                <p className={`progress__status progress__status--${video.status}`} role="status">{STATUS_LABELS[video.status]}</p>
                <progress className="progress__bar" max={video.frameCount} value={video.framesDone} aria-label="Frames generated" />
                <p className="progress__count">{video.framesDone} of {video.frameCount} frames</p>

                {video.error && <p className="alert" role="alert">{video.error}</p>}
                {error && <p className="alert" role="alert">{error}</p>}

                <div className="progress__actions">
                    {video.status === 'done' && <a className="button button--primary" href={videoUrl(video.id)} download={downloadName(video.name)}>Download MP4</a>}
                    {stopped && <button type="button" className="button button--primary" disabled={retrying} onClick={retry}>{retrying ? 'Retrying…' : 'Retry'}</button>}
                    {selected !== null && video.status !== 'done' && <button type="button" className="button" onClick={() => setSelected(null)}>Follow latest frame</button>}
                    <Link className="button" to="/" state={{ fresh: true }}>New video</Link>
                    <Link className="button" to="/videos">All videos</Link>
                </div>
            </div>

            {video.status !== 'done' && video.framesDone > 0 && <Filmstrip videoId={video.id} framesDone={video.framesDone} current={current} following={selected === null} onSelect={setSelected} />}
        </div>
    );
};

type VideoProgressProps = {
    videoId: string;
};
