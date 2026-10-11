import type { ClaudeContent, Frame } from '../types';

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

export const SYSTEM_PROMPT = [
    'You are an illustrator and animator who draws exclusively in SVG.',
    `Reply with exactly one complete SVG document and nothing else: no prose, no markdown, no code fences.`,
    'Rules for the SVG:',
    `- The root is <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}"> (portrait 9:16).`,
    `- The first child is an opaque background covering the whole ${FRAME_WIDTH}×${FRAME_HEIGHT} canvas.`,
    '- It is a single still picture: no <script>, no event handlers, no <animate> or CSS animation.',
    '- It is self-contained: no <image>, <foreignObject>, external fonts, stylesheets or URLs. href and url() may only reference ids inside the document.',
    '- Text uses generic font families only (sans-serif, serif, monospace).',
    '- Keep it rich but compact, well under 30 KB, and keep important content away from the outer 60px.'
].join('\n');

export function buildFirstFramePrompt(prompt: string, frameCount: number): ClaudeContent {
    return [{
        type: 'text',
        text: [
            `You are drawing frame 1 of ${frameCount} of a vertical video. Frames are one second apart.`,
            `Video prompt:\n${prompt}`,
            'Draw the opening frame. Establish the scene, palette and visual style that the rest of the video will keep.',
            'Give stable ids to the elements that will move or change, so the following frames can evolve them.'
        ].join('\n\n')
    }];
}

export function buildNextFramePrompt(prompt: string, index: number, frameCount: number, previous: Frame): ClaudeContent {
    return [
        {
            type: 'text',
            text: [
                `You are drawing frame ${index} of ${frameCount} of a vertical video. Frames are one second apart.`,
                `Video prompt:\n${prompt}`,
                `The only thing you know about the video so far is frame ${previous.index}. Its rendered picture is attached and its SVG source is:`,
                previous.svg
            ].join('\n\n')
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: previous.png.toString('base64') } },
        {
            type: 'text',
            text: [
                `Draw frame ${index}: the same scene one second later.`,
                'Start from the previous SVG and keep its style, palette, ids and composition, changing only what one second of motion or story progress would change.',
                `The change must be clearly visible yet continuous, the frames will be cross-faded.${index === frameCount ? ' This is the last frame, bring the video to a satisfying close.' : ''}`
            ].join('\n')
        }
    ];
}

export function buildImagePrompt(prompt: string): ClaudeContent {
    return [{
        type: 'text',
        text: [
            'Draw a single standalone illustration.',
            `Image prompt:\n${prompt}`
        ].join('\n\n')
    }];
}
