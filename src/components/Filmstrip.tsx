import { useEffect, useRef } from 'react';
import { frameUrl } from '../api/videos';

export const Filmstrip = ({ videoId, framesDone, current, following, onSelect }: FilmstripProps) => {
    const strip = useRef<HTMLOListElement>(null);

    useEffect(() => {
        if (following) strip.current?.scrollTo({ left: strip.current.scrollWidth });
    }, [framesDone, following]);

    return (
        <ol className="filmstrip" ref={strip} aria-label="Generated frames">
            {Array.from({ length: framesDone }, (_, i) => i + 1).map((index) => (
                <li key={index}>
                    <button type="button" className={`filmstrip__frame${index === current ? ' filmstrip__frame--active' : ''}`} onClick={() => onSelect(index)} aria-current={index === current ? 'true' : undefined} aria-label={`Frame ${index}`}>
                        <img className="filmstrip__picture" src={frameUrl(videoId, index)} alt="" loading="lazy" />
                        <span className="filmstrip__index">{index}</span>
                    </button>
                </li>
            ))}
        </ol>
    );
};

type FilmstripProps = {
    videoId: string;
    framesDone: number;
    current: number;
    following: boolean;
    onSelect: (index: number) => void;
};
