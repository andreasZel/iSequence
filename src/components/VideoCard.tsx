import { Link } from 'react-router-dom';
import type { Video, VideoStatus } from '../../server/types';
import { downloadName, frameUrl, isActive, videoUrl } from '../api/videos';

const STATUS_LABELS: Record<VideoStatus, string> = {
    queued: 'Queued',
    generating: 'Generating',
    encoding: 'Encoding',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled'
};

export const VideoCard = ({ video, playing, busy, onPlay, onRetry, onDelete }: VideoCardProps) => {
    const active = isActive(video.status);
    const stopped = video.status === 'failed' || video.status === 'cancelled';

    return (
        <li className="video-card">
            <div className="video-card__stage">
                {playing && <video className="video-card__picture" src={videoUrl(video.id)} poster={frameUrl(video.id, 1)} controls autoPlay playsInline />}
                {!playing && video.framesDone > 0 && <img className="video-card__picture" src={frameUrl(video.id, 1)} alt={`First frame of ${video.name}`} loading="lazy" />}
                {!playing && video.framesDone === 0 && <div className={`video-card__picture video-card__picture--empty${active ? ' video-card__picture--pending' : ''}`}>No frames yet</div>}
                {!playing && video.status === 'done' && <button type="button" className="video-card__play" aria-label={`Play ${video.name}`} onClick={() => onPlay(video.id)}>▶</button>}
            </div>

            <h2 className="video-card__name" title={video.name}>{video.name}</h2>
            <time className="video-card__date" dateTime={video.createdAt}>{new Date(video.createdAt).toLocaleString()}</time>
            <p className={`video-card__status video-card__status--${video.status}`}>
                {STATUS_LABELS[video.status]}{video.status !== 'done' && ` · ${video.framesDone} of ${video.frameCount}`}
            </p>
            {stopped && video.error && <p className="video-card__error" title={video.error}>{video.error}</p>}

            <div className="video-card__actions">
                {video.status === 'done' && <a className="button button--small" href={videoUrl(video.id)} download={downloadName(video.name)}>Download</a>}
                {active && <Link className="button button--small" to={`/?video=${video.id}`}>View progress</Link>}
                {stopped && <button type="button" className="button button--small" disabled={busy} onClick={() => onRetry(video.id)}>Retry</button>}
                <button type="button" className="button button--small button--danger" disabled={busy} onClick={() => onDelete(video)}>Delete</button>
            </div>
        </li>
    );
};

type VideoCardProps = {
    video: Video;
    playing: boolean;
    busy: boolean;
    onPlay: (id: string) => void;
    onRetry: (id: string) => void;
    onDelete: (video: Video) => void;
};
