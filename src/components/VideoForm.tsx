import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Video } from '../../server/types';
import { createVideo } from '../api/videos';

const MAX_NAME_LENGTH = 120;
const MAX_PROMPT_LENGTH = 2000;

export const VideoForm = ({ onCreated }: VideoFormProps) => {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ready = Boolean(name.trim() && prompt.trim());

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!ready || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            onCreated(await createVideo(name.trim(), prompt.trim()));
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
            <div className="form__footer">
                <button type="submit" className="button button--primary" disabled={!ready || submitting}>
                    {submitting ? 'Starting…' : 'Generate'}
                </button>
                <span className="form__status">60 frames, one per second, drawn one after the other.</span>
            </div>
            {error && <p className="alert" role="alert">{error}</p>}
        </form>
    );
};

type VideoFormProps = {
    onCreated: (video: Video) => void;
};
