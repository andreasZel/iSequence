import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SvgRenderError, svgToPng } from '../server/render/svgToPng';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_RGBA = 6;

function header(png: Buffer) {
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), colorType: png[25] };
}

test('renders exactly 1080×1920', () => {
    const png = svgToPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#123"/><text x="540" y="960" font-family="sans-serif" font-size="80" fill="#fff" text-anchor="middle">Hello</text></svg>');
    const { width, height } = header(png);
    assert.deepEqual([width, height], [1080, 1920]);
});

test('ignores a root size that disagrees with the frame', () => {
    const sizes = ['width="100" height="100"', 'width="1920" height="1080"', "width='50%' preserveAspectRatio='xMidYMid slice'"];
    for (const size of sizes) {
        const { width, height } = header(svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 1080 1920"><circle cx="540" cy="960" r="300" fill="red"/></svg>`));
        assert.deepEqual([width, height], [1080, 1920], size);
    }
});

test('a transparent svg still gets an opaque background', async () => {
    const png = svgToPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"></svg>');
    const { colorType } = header(png);
    assert.ok(colorType === COLOR_TYPE_RGB || colorType === COLOR_TYPE_RGBA);
    if (colorType === COLOR_TYPE_RGB) return;
    const { Resvg } = await import('@resvg/resvg-js');
    const href = `data:image/png;base64,${png.toString('base64')}`;
    const pixels = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><image href="${href}" width="4" height="4" preserveAspectRatio="none"/></svg>`).render().pixels;
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255);
});

test('broken svg surfaces a render error', () => {
    assert.throws(() => svgToPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect></svg>'), SvgRenderError);
    assert.throws(() => svgToPng('not an svg'), SvgRenderError);
});
