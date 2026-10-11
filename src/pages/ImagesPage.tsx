import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ImageItem } from '../../server/types';
import { fetchImages, generateImage, removeImage } from '../api/images';
import { ImageCard } from '../components/ImageCard';

const MAX_PROMPT_LENGTH = 2000;

export const ImagesPage = () => {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [deletingIds, setDeletingIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        fetchImages()
            .then((items) => active && setImages(items))
            .catch((reason: Error) => active && setError(reason.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!prompt.trim() || generating) return;
        setGenerating(true);
        setError(null);
        try {
            const image = await generateImage(prompt.trim());
            setImages((current) => [image, ...current]);
            setPrompt('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Image generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this image?')) return;
        setDeletingIds((current) => [...current, id]);
        setError(null);
        try {
            await removeImage(id);
            setImages((current) => current.filter((image) => image.id !== id));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The image could not be deleted');
        } finally {
            setDeletingIds((current) => current.filter((item) => item !== id));
        }
    };

    return (
        <section className="page">
            <h1 className="page__title">Images</h1>
            <p className="page__hint">Describe a picture and Claude draws it as a 1080×1920 image.</p>

            <form className="form" onSubmit={handleSubmit}>
                <label className="form__label" htmlFor="image-prompt">Prompt</label>
                <textarea id="image-prompt" className="form__input" rows={4} maxLength={MAX_PROMPT_LENGTH} placeholder="A lighthouse on a cliff at dusk, flat vector style" value={prompt} disabled={generating} onChange={(event) => setPrompt(event.target.value)} />
                <div className="form__footer">
                    <button type="submit" className="button button--primary" disabled={generating || !prompt.trim()}>
                        {generating ? 'Generating…' : 'Generate image'}
                    </button>
                    {generating && <span className="form__status" role="status">Claude is drawing, this can take a minute.</span>}
                </div>
            </form>

            {error && <p className="alert" role="alert">{error}</p>}

            {loading && <p className="page__hint">Loading images…</p>}
            {!loading && !generating && images.length === 0 && <p className="page__hint">No images yet.</p>}

            <ul className="gallery">
                {generating && (
                    <li className="image-card image-card--pending" aria-hidden="true">
                        <div className="image-card__picture image-card__picture--pending" />
                        <p className="image-card__prompt">{prompt}</p>
                    </li>
                )}
                {images.map((image) => (
                    <ImageCard key={image.id} image={image} deleting={deletingIds.includes(image.id)} onDelete={handleDelete} />
                ))}
            </ul>
        </section>
    );
};
