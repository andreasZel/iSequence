import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { describeError, logError, redactSecrets } from '../server/redact';

afterEach(() => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.G_TOKEN;
});

test('token values are replaced wherever they appear', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-abcdef';
    process.env.G_TOKEN = 'github_pat_123456';
    assert.equal(redactSecrets('a sk-ant-oat01-abcdef b github_pat_123456 c sk-ant-oat01-abcdef'), 'a [redacted] b [redacted] c [redacted]');
    assert.equal(describeError(new Error('bad token sk-ant-oat01-abcdef')), 'bad token [redacted]');
});

test('text is untouched without tokens, short values are ignored', () => {
    assert.equal(redactSecrets('nothing to hide'), 'nothing to hide');
    process.env.G_TOKEN = 'abc';
    assert.equal(redactSecrets('abc stays'), 'abc stays');
    assert.equal(describeError(new Error(''), 'Image generation failed'), 'Image generation failed');
});

test('logged errors are redacted', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-abcdef';
    const original = console.error;
    const lines: string[] = [];
    console.error = (...parts: unknown[]) => void lines.push(parts.join(' '));
    try {
        logError('Request failed', new Error('spawn failed with sk-ant-oat01-abcdef'));
    } finally {
        console.error = original;
    }
    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith('Request failed') && lines[0].includes('[redacted]') && !lines[0].includes('abcdef'));
});
