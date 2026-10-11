import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';

if (existsSync('.env')) process.loadEnvFile('.env');

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIR = path.resolve('dist');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, claudeTokenConfigured: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN) });
});

if (existsSync(CLIENT_DIR)) {
    app.use(express.static(CLIENT_DIR));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

app.listen(PORT, () => console.log(`iSequence server on http://localhost:${PORT}`));
