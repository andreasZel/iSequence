export class ApiError extends Error {
    name = 'ApiError';

    constructor(message: string, public status: number) {
        super(message);
    }
}

export async function readError(response: Response) {
    const body = await response.json().catch(() => null);
    if (typeof body?.error === 'string') return new ApiError(body.error, response.status);
    return new ApiError(response.status >= 500 ? 'The server is not responding. Try again in a moment.' : `Request failed (${response.status})`, response.status);
}

export async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, init).catch(() => {
        throw new ApiError('The server cannot be reached. Check your connection and try again.', 0);
    });
    if (!response.ok) throw await readError(response);
    return response;
}
