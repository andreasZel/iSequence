import { FRAME_HEIGHT, FRAME_WIDTH } from './prompts';

const FORBIDDEN: [RegExp, string][] = [
    [/<!DOCTYPE|<!ENTITY/i, 'a doctype or entity declaration'],
    [/<script[\s>/]/i, 'a <script> element'],
    [/<foreignObject[\s>/]/i, 'a <foreignObject> element'],
    [/<(image|iframe|embed|object|audio|video)[\s>/]/i, 'an embedded media element'],
    [/\son[a-z]+\s*=/i, 'an event handler attribute'],
    [/(?:xlink:)?href\s*=\s*["']\s*(?!#)/i, 'a link to something outside the document'],
    [/url\(\s*["']?\s*(?!#)/i, 'a url() pointing outside the document'],
    [/@import/i, 'a CSS @import'],
    [/javascript:/i, 'a javascript: URL']
];

export class SvgValidationError extends Error {
    name = 'SvgValidationError';
}

export function extractSvg(text: string) {
    const start = text.search(/<svg[\s>]/i);
    const end = text.lastIndexOf('</svg>');
    if (start === -1 || end < start) throw new SvgValidationError('The response has no <svg>…</svg> document');
    return text.slice(start, end + '</svg>'.length).trim();
}

export function validateSvg(svg: string) {
    const root = /^<svg\b[^>]*>/i.exec(svg)?.[0];
    if (!root || !svg.endsWith('</svg>')) throw new SvgValidationError('The root element is not <svg>');
    if (!/\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(root)) throw new SvgValidationError('The <svg> root has no SVG xmlns');
    const viewBox = /\sviewBox\s*=\s*["']([^"']*)["']/.exec(root)?.[1].trim().split(/[\s,]+/).map(Number);
    if (!viewBox || viewBox.join(' ') !== `0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`) throw new SvgValidationError(`The viewBox must be "0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}"`);
    const withoutComments = svg.replace(/<!--[\s\S]*?-->/g, '');
    for (const [pattern, label] of FORBIDDEN) {
        if (pattern.test(withoutComments)) throw new SvgValidationError(`The SVG contains ${label}`);
    }
    return svg;
}

export function parseSvgResponse(text: string) {
    return validateSvg(extractSvg(text));
}
