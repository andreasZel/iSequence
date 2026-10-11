import type { Frame } from '../types';
import { askClaude } from './client';
import { SYSTEM_PROMPT, buildFirstFramePrompt, buildImagePrompt, buildNextFramePrompt } from './prompts';
import { parseSvgResponse } from './svg';

export async function generateFirstFrameSvg(prompt: string, frameCount: number, signal?: AbortSignal) {
    return parseSvgResponse(await askClaude(SYSTEM_PROMPT, buildFirstFramePrompt(prompt, frameCount), signal));
}

export async function generateNextFrameSvg(prompt: string, index: number, frameCount: number, previous: Frame, signal?: AbortSignal) {
    return parseSvgResponse(await askClaude(SYSTEM_PROMPT, buildNextFramePrompt(prompt, index, frameCount, previous), signal));
}

export async function generateImageSvg(prompt: string, signal?: AbortSignal) {
    return parseSvgResponse(await askClaude(SYSTEM_PROMPT, buildImagePrompt(prompt), signal));
}
