import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeContent } from '../types';

export const CLAUDE_MODEL = 'claude-opus-5-5';

export class ClaudeConfigError extends Error {
    name = 'ClaudeConfigError';
}

export class ClaudeRequestError extends Error {
    name = 'ClaudeRequestError';
}

export function assertClaudeConfigured() {
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) throw new ClaudeConfigError('CLAUDE_CODE_OAUTH_TOKEN is missing. Create one with "claude setup-token" and add it to .env');
}

async function* singleMessage(content: ClaudeContent): AsyncGenerator<SDKUserMessage> {
    yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, session_id: '' };
}

export async function askClaude(systemPrompt: string, content: ClaudeContent, signal?: AbortSignal) {
    assertClaudeConfigured();
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    // The Claude process never needs the GitHub token.
    const { G_TOKEN: _githubToken, ...env } = process.env;
    try {
        const stream = query({
            prompt: singleMessage(content),
            options: { model: CLAUDE_MODEL, systemPrompt, tools: [], mcpServers: {}, settingSources: [], maxTurns: 1, persistSession: false, abortController, env }
        });
        for await (const message of stream) {
            if (message.type !== 'result') continue;
            if (message.subtype !== 'success' || message.is_error) throw new ClaudeRequestError(`Claude request failed: ${message.subtype === 'success' ? message.result : message.subtype}`);
            return message.result;
        }
        throw new ClaudeRequestError('Claude returned no result');
    } finally {
        signal?.removeEventListener('abort', abort);
    }
}
