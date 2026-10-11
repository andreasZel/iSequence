import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import express from 'express';
import { ClaudeConfigError } from '../server/claude/client';
import { createImagesRouter } from '../server/routes/images';
import { imagePath } from '../server/store/images';

const dir = mkdtempSync(path.join(tmpdir(), 'isequence-api-'));
process.env.DATA_DIR = dir;

const GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#246"/></svg>';
const BROKEN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect></svg>';

let replies: (string | Error)[] = [];
let calls = 0;

const app = express();
app.use(express.json());
app.use('/api/images', createImagesRouter(async () => {
    calls++;
    const reply = replies.shift() ?? GOOD_SVG;
    if (reply instanceof Error) throw reply;
    return reply;
}));
const server = app.listen(0);
const base = () => `http://localhost:${(server.address() as AddressInfo).port}/api/images`;
const post = (body: unknown) => fetch(base(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

after(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
});

test('creates, lists and deletes an image', async () => {
    const created = await post({ prompt: '  a blue wall  ' });
    assert.equal(created.status, 201);
    const image = await created.json();
    assert.equal(image.prompt, 'a blue wall');
    assert.ok(existsSync(imagePath(image.id, 'png')) && existsSync(imagePath(image.id, 'svg')));
    assert.deepEqual(await (await fetch(base())).json(), [image]);

    assert.equal((await fetch(`${base()}/${image.id}`, { method: 'DELETE' })).status, 204);
    assert.ok(!existsSync(imagePath(image.id, 'png')));
    assert.deepEqual(await (await fetch(base())).json(), []);
});

test('rejects a missing prompt and a bad id', async () => {
    calls = 0;
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ prompt: '   ' })).status, 400);
    assert.equal((await post({ prompt: 'x'.repeat(2001) })).status, 400);
    assert.equal(calls, 0);
    assert.equal((await fetch(`${base()}/not-an-id`, { method: 'DELETE' })).status, 400);
});

test('retries once when the drawing cannot be rendered', async () => {
    calls = 0;
    replies = [BROKEN_SVG];
    assert.equal((await post({ prompt: 'retry me' })).status, 201);
    assert.equal(calls, 2);

    calls = 0;
    replies = [BROKEN_SVG, BROKEN_SVG];
    const failed = await post({ prompt: 'never works' });
    assert.equal(failed.status, 502);
    assert.equal(calls, 2);
    assert.equal(typeof (await failed.json()).error, 'string');
});

test('a missing token is reported as 503 without retrying', async () => {
    calls = 0;
    replies = [new ClaudeConfigError('CLAUDE_CODE_OAUTH_TOKEN is missing')];
    const response = await post({ prompt: 'no token' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /CLAUDE_CODE_OAUTH_TOKEN/);
    assert.equal(calls, 1);
});
