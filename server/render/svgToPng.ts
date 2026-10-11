import { Resvg } from '@resvg/resvg-js';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../claude/prompts';

const BACKGROUND = '#000000';

export class SvgRenderError extends Error {
    name = 'SvgRenderError';
}

function withFrameSize(svg: string) {
    const root = /<svg\b[^>]*>/i.exec(svg);
    if (!root) throw new SvgRenderError('The SVG has no <svg> root element');
    const sized = root[0].replace(/\s(?:width|height|preserveAspectRatio)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '').replace(/^<svg/i, `<svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" preserveAspectRatio="none"`);
    return svg.slice(0, root.index) + sized + svg.slice(root.index + root[0].length);
}

export function svgToPng(svg: string) {
    const sized = withFrameSize(svg);
    try {
        const image = new Resvg(sized, { background: BACKGROUND, fitTo: { mode: 'original' }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render();
        if (image.width !== FRAME_WIDTH || image.height !== FRAME_HEIGHT) throw new SvgRenderError(`Rendered ${image.width}×${image.height} instead of ${FRAME_WIDTH}×${FRAME_HEIGHT}`);
        return image.asPng();
    } catch (error) {
        if (error instanceof SvgRenderError) throw error;
        throw new SvgRenderError(`The SVG could not be rendered: ${error instanceof Error ? error.message : String(error)}`);
    }
}
