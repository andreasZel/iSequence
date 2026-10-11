import { Router } from 'express';
import type { Response } from 'express';
import { resolveFrameCount } from '../jobs/videoJobs';
import type { VideoJobs } from '../jobs/videoJobs';
import { isValidId } from '../store/paths';
import { createVideo, deleteVideo, getVideo, listVideos } from '../store/videos';
import type { VideoStatus, VideoStreamEvent } from '../types';

const MAX_NAME_LENGTH = 120;
const MAX_PROMPT_LENGTH = 2000;
const HEARTBEAT_MS = 15000;
const RETRYABLE: VideoStatus[] = ['failed', 'cancelled'];

function readText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function writeEvent(res: Response, event: VideoStreamEvent) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function createVideosRouter(jobs: VideoJobs) {
    const router = Router();

    router.param('id', (_req, res, next, id) => {
        if (!isValidId(id)) return void res.status(400).json({ error: 'Invalid video id' });
        next();
    });

    router.get('/', async (_req, res) => {
        res.json(await listVideos());
    });

    router.post('/', async (req, res) => {
        const name = readText(req.body?.name);
        const prompt = readText(req.body?.prompt);
        if (!name) return void res.status(400).json({ error: 'A video name is required' });
        if (!prompt) return void res.status(400).json({ error: 'A prompt is required' });
        if (name.length > MAX_NAME_LENGTH) return void res.status(400).json({ error: `The name is longer than ${MAX_NAME_LENGTH} characters` });
        if (prompt.length > MAX_PROMPT_LENGTH) return void res.status(400).json({ error: `The prompt is longer than ${MAX_PROMPT_LENGTH} characters` });
        const video = await createVideo(name, prompt, resolveFrameCount());
        await jobs.enqueue(video.id);
        res.status(201).json(video);
    });

    router.get('/:id', async (req, res) => {
        const video = await getVideo(req.params.id);
        if (!video) return void res.status(404).json({ error: 'Video not found' });
        res.json(video);
    });

    router.delete('/:id', async (req, res) => {
        await jobs.cancel(req.params.id);
        await deleteVideo(req.params.id);
        res.status(204).end();
    });

    router.post('/:id/retry', async (req, res) => {
        const video = await getVideo(req.params.id);
        if (!video) return void res.status(404).json({ error: 'Video not found' });
        if (!RETRYABLE.includes(video.status) || jobs.isPending(video.id)) return void res.status(409).json({ error: `A video that is ${video.status} cannot be retried` });
        await jobs.enqueue(video.id);
        res.status(202).json(await getVideo(video.id));
    });

    router.post('/:id/cancel', async (req, res) => {
        const video = await getVideo(req.params.id);
        if (!video) return void res.status(404).json({ error: 'Video not found' });
        if (!jobs.isPending(video.id)) return void res.status(409).json({ error: `A video that is ${video.status} cannot be cancelled` });
        await jobs.cancel(video.id);
        res.json(await getVideo(video.id));
    });

    router.get('/:id/events', async (req, res) => {
        const id = req.params.id;
        const early: VideoStreamEvent[] = [];
        let ready = false;
        const unsubscribe = jobs.subscribe((event) => {
            if (event.videoId !== id) return;
            if (ready) writeEvent(res, event);
            else early.push(event);
        });
        const video = await getVideo(id);
        if (!video) {
            unsubscribe();
            return void res.status(404).json({ error: 'Video not found' });
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        writeEvent(res, { type: 'snapshot', videoId: id, video });
        for (const event of early) writeEvent(res, event);
        ready = true;
        const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
        req.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
        });
    });

    return router;
}
