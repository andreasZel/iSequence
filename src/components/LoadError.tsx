export const LoadError = ({ message, onRetry }: LoadErrorProps) => {
    return (
        <div className="alert alert--action alert--spaced" role="alert">
            <span>{message}</span>
            <button type="button" className="button button--small" onClick={onRetry}>Try again</button>
        </div>
    );
};

type LoadErrorProps = {
    message: string;
    onRetry: () => void;
};
