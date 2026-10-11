import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
    return (
        <section className="page">
            <h1 className="page__title">Page not found</h1>
            <p className="page__hint">There is nothing at this address.</p>
            <div className="progress__actions">
                <Link className="button button--primary" to="/" state={{ fresh: true }}>Create a video</Link>
                <Link className="button" to="/videos">All videos</Link>
            </div>
        </section>
    );
};
