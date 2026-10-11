import type { ImageItem } from '../../server/types';
import { imageUrl } from '../api/images';

export const ImageCard = ({ image, deleting, onDelete }: ImageCardProps) => {
    return (
        <li className="image-card">
            <a href={imageUrl(image.id)} target="_blank" rel="noreferrer">
                <img className="image-card__picture" src={imageUrl(image.id)} alt={image.prompt} loading="lazy" />
            </a>
            <p className="image-card__prompt" title={image.prompt}>{image.prompt}</p>
            <time className="image-card__date" dateTime={image.createdAt}>{new Date(image.createdAt).toLocaleString()}</time>
            <div className="image-card__actions">
                <a className="button button--small" href={imageUrl(image.id)} download={`isequence-${image.id.slice(0, 8)}.png`}>Download</a>
                <button type="button" className="button button--small button--danger" disabled={deleting} onClick={() => onDelete(image.id)}>
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </li>
    );
};

type ImageCardProps = {
    image: ImageItem;
    deleting: boolean;
    onDelete: (id: string) => void;
};
