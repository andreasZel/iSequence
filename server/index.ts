import './env';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { createImagesRouter } from './routes/images';
import { dataDir } from './store/paths';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIR = path.resolve('dist');
const MEDIA_EXTENSIONS = ['.png', '.mp4'];

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, claudeTokenConfigured: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN) });
});

app.use('/api/images', createImagesRouter());

app.use('/media', (req, res, next) => {
    if (!MEDIA_EXTENSIONS.includes(path.extname(req.path).toLowerCase())) return void res.status(404).end();
    next();
}, express.static(dataDir(), { fallthrough: false }));

if (existsSync(CLIENT_DIR)) {
    app.use(express.static(CLIENT_DIR));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
};
app.use(handleError);

app.listen(PORT, () => console.log(`iSequence server on http://localhost:${PORT}`));
