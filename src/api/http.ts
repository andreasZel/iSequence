export async function readError(response: Response) {
    const body = await response.json().catch(() => null);
    return new Error(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`);
}
