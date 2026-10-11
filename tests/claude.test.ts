import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClaudeConfigError, askClaude } from '../server/claude/client';
import { buildFirstFramePrompt, buildImagePrompt, buildNextFramePrompt } from '../server/claude/prompts';
import { SvgValidationError, extractSvg, parseSvgResponse, validateSvg } from '../server/claude/svg';

const OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">';
const wrap = (body: string) => `${OPEN}${body}</svg>`;

test('extracts the svg from fences and prose', () => {
    const svg = wrap('<rect width="1080" height="1920" fill="#000"/>');
    assert.equal(extractSvg(`Here it is:\n\`\`\`svg\n${svg}\n\`\`\`\nDone.`), svg);
    assert.equal(parseSvgResponse(`<?xml version="1.0"?>\n${svg}`), svg);
    assert.throws(() => extractSvg('no drawing here'), SvgValidationError);
});

test('accepts internal references', () => {
    const svg = wrap('<defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/><!-- <script> -->');
    assert.equal(validateSvg(svg), svg);
});

test('rejects a wrong root or viewBox', () => {
    assert.throws(() => validateSvg('<div></div>'), SvgValidationError);
    assert.throws(() => validateSvg('<svg viewBox="0 0 1080 1920"></svg>'), /xmlns/);
    assert.throws(() => validateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>'), /viewBox/);
    assert.throws(() => validateSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), /viewBox/);
});

test('rejects scripts and external references', () => {
    const bodies = [
        '<script>alert(1)</script>',
        '<rect onclick="x()"/>',
        '<image href="https://example.com/a.png"/>',
        '<use xlink:href="other.svg#a"/>',
        '<a href="javascript:x()"><rect/></a>',
        '<rect fill="url(https://example.com/p.svg#g)"/>',
        '<style>@import "https://example.com/a.css";</style>',
        '<foreignObject><p>hi</p></foreignObject>'
    ];
    for (const body of bodies) assert.throws(() => validateSvg(wrap(body)), SvgValidationError, body);
});

test('first frame and image prompts carry the user prompt', () => {
    const first = buildFirstFramePrompt('a sunrise over the sea', 60);
    assert.equal(first.length, 1);
    assert.ok(first[0].type === 'text' && first[0].text.includes('a sunrise over the sea') && first[0].text.includes('frame 1 of 60'));
    const image = buildImagePrompt('a red fox');
    assert.ok(image[0].type === 'text' && image[0].text.includes('a red fox'));
});

test('next frame prompt carries only the previous frame', () => {
    const previous = { index: 4, svg: wrap('<circle id="sun"/>'), png: Buffer.from('png-bytes') };
    const blocks = buildNextFramePrompt('a sunrise', 5, 60, previous);
    const text = blocks.flatMap((block) => block.type === 'text' ? [block.text] : []).join('\n');
    const images = blocks.flatMap((block) => block.type === 'image' ? [block.source] : []);
    assert.ok(text.includes('frame 5 of 60') && text.includes(previous.svg) && text.includes('a sunrise'));
    assert.deepEqual(images, [{ type: 'base64', media_type: 'image/png', data: previous.png.toString('base64') }]);
    assert.ok(!text.includes('last frame'));
    assert.ok(buildNextFramePrompt('a sunrise', 60, 60, previous).some((block) => block.type === 'text' && block.text.includes('last frame')));
});

test('a missing token is a configuration error', async () => {
    const saved = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    await assert.rejects(askClaude('system', buildImagePrompt('x')), ClaudeConfigError);
    if (saved !== undefined) process.env.CLAUDE_CODE_OAUTH_TOKEN = saved;
});
