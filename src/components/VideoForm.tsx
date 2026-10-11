import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Video } from '../../server/types';
import { createVideo, fetchDefaultFrameCount } from '../api/videos';

const MAX_NAME_LENGTH = 120;
const MAX_PROMPT_LENGTH = 2000;
const MAX_FRAME_COUNT = 60;

export const VideoForm = ({ onCreated }: VideoFormProps) => {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [frameCount, setFrameCount] = useState(String(MAX_FRAME_COUNT));
    const [frameCountEdited, setFrameCountEdited] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const frames = Number(frameCount);
    const framesValid = Number.isInteger(frames) && frames >= 1 && frames <= MAX_FRAME_COUNT;
    const ready = Boolean(name.trim() && prompt.trim()) && framesValid;

    useEffect(() => {
        if (frameCountEdited) return;
        let active = true;
        fetchDefaultFrameCount().then((count) => active && setFrameCount(String(count))).catch(() => undefined);
        return () => {
            active = false;
        };
    }, [frameCountEdited]);

    const handleFrameCountChange = (value: string) => {
        setFrameCountEdited(true);
        setFrameCount(value);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!ready || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            onCreated(await createVideo(name.trim(), prompt.trim(), frames));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The video could not be created');
            setSubmitting(false);
        }
    };

    return (
        <form className="form" onSubmit={handleSubmit}>
            <label className="form__label" htmlFor="video-name">Video name</label>
            <input id="video-name" className="form__input" type="text" required maxLength={MAX_NAME_LENGTH} placeholder="Lighthouse storm" value={name} disabled={submitting} onChange={(event) => setName(event.target.value)} />
            <label className="form__label" htmlFor="video-prompt">Prompt</label>
            <textarea id="video-prompt" className="form__input" rows={5} required maxLength={MAX_PROMPT_LENGTH} placeholder="A storm rolls in over a lighthouse, waves grow, then the sky clears at dawn" value={prompt} disabled={submitting} onChange={(event) => setPrompt(event.target.value)} />
            <label className="form__label" htmlFor="video-frames">Frames (1 to {MAX_FRAME_COUNT}, one per second of video)</label>
            <input id="video-frames" className="form__input form__input--short" type="number" required min={1} max={MAX_FRAME_COUNT} step={1} inputMode="numeric" value={frameCount} disabled={submitting} onChange={(event) => handleFrameCountChange(event.target.value)} />
            <div className="form__footer">
                <button type="submit" className="button button--primary" disabled={!ready || submitting}>
                    {submitting ? 'Starting…' : 'Generate'}
                </button>
                <span className="form__status">{framesValid ? `${frames} ${frames === 1 ? 'frame' : 'frames'}, a ${frames} second video, drawn one after the other.` : `Enter a whole number of frames from 1 to ${MAX_FRAME_COUNT}.`}</span>
            </div>
            {error && <p className="alert" role="alert">{error}</p>}
        </form>
    );
};

type VideoFormProps = {
    onCreated: (video: Video) => void;
};
