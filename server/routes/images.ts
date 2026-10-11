import { Router } from 'express';
import { ClaudeConfigError } from '../claude/client';
import { generateImageSvg } from '../claude/generate';
import { SvgValidationError } from '../claude/svg';
import { SvgRenderError, svgToPng } from '../render/svgToPng';
import { createImage, deleteImage, listImages } from '../store/images';
import { isValidId } from '../store/paths';

const MAX_PROMPT_LENGTH = 2000;
const MAX_ATTEMPTS = 2;

async function drawImage(generate: GenerateImageSvg, prompt: string) {
    for (let attempt = 1; ; attempt++) {
        try {
            const svg = await generate(prompt);
            return { svg, png: svgToPng(svg) };
        } catch (error) {
            const retryable = error instanceof SvgValidationError || error instanceof SvgRenderError;
            if (!retryable || attempt === MAX_ATTEMPTS) throw error;
        }
    }
}

export function createImagesRouter(generate: GenerateImageSvg = generateImageSvg) {
    const router = Router();

    router.get('/', async (_req, res) => {
        res.json(await listImages());
    });

    router.post('/', async (req, res) => {
        const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
        if (!prompt) return void res.status(400).json({ error: 'A prompt is required' });
        if (prompt.length > MAX_PROMPT_LENGTH) return void res.status(400).json({ error: `The prompt is longer than ${MAX_PROMPT_LENGTH} characters` });
        try {
            const { svg, png } = await drawImage(generate, prompt);
            res.status(201).json(await createImage(prompt, svg, png));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Image generation failed';
            res.status(error instanceof ClaudeConfigError ? 503 : 502).json({ error: message });
        }
    });

    router.delete('/:id', async (req, res) => {
        if (!isValidId(req.params.id)) return void res.status(400).json({ error: 'Invalid image id' });
        await deleteImage(req.params.id);
        res.status(204).end();
    });

    return router;
}

type GenerateImageSvg = (prompt: string) => Promise<string>;
