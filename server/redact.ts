const SECRET_NAMES = ['CLAUDE_CODE_OAUTH_TOKEN', 'G_TOKEN'];
const MIN_SECRET_LENGTH = 8;
const REDACTED = '[redacted]';

export function redactSecrets(text: string) {
    let result = text;
    for (const name of SECRET_NAMES) {
        const secret = process.env[name]?.trim();
        if (secret && secret.length >= MIN_SECRET_LENGTH) result = result.split(secret).join(REDACTED);
    }
    return result;
}

export function describeError(error: unknown, fallback = 'Unknown error') {
    return redactSecrets(error instanceof Error ? error.message || fallback : String(error ?? fallback));
}

export function logError(label: string, error: unknown) {
    console.error(label, redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
}
