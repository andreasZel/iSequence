import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TASKS_FILE = 'Tasks.md';
const HEADING = /^### (T\d+) — (.+)$/;

if (existsSync('.env')) process.loadEnvFile('.env');

const token = process.env.G_TOKEN;
if (!token) fail('G_TOKEN is missing, add it to .env');

const repo = resolveRepo();
const [command, ...args] = process.argv.slice(2);

if (command === 'issues') await createIssues();
else if (command === 'close') await closeIssue(args[0]);
else if (command === 'pr') await openPullRequest(args[0], args[1], args[2], args[3]);
else fail('usage: github.mjs issues | close <number> | pr <head> <base> <title> [issue]');

async function createIssues() {
    const lines = readFileSync(TASKS_FILE, 'utf8').split(/\r?\n/);
    const existing = await listIssues();

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(HEADING);
        if (!match) continue;

        const issueLine = findIssueLine(lines, i);
        if (issueLine === -1 || !lines[issueLine].includes('pending')) continue;

        const title = `${match[1]}: ${match[2]}`;
        const found = existing.find((issue) => issue.title === title);
        const number = found ? found.number : (await api('POST', '/issues', { title, body: buildBody(lines, i) })).number;

        lines[issueLine] = `- Issue: #${number}`;
        console.log(`${found ? 'exists ' : 'created'} #${number} ${title}`);
    }

    writeFileSync(TASKS_FILE, lines.join('\n'));
}

async function closeIssue(number) {
    if (!number) fail('usage: github.mjs close <number>');
    await api('PATCH', `/issues/${number}`, { state: 'closed' });
    console.log(`closed #${number}`);
}

async function openPullRequest(head, base, title, issue) {
    if (!head || !base || !title) fail('usage: github.mjs pr <head> <base> <title> [issue]');
    const footer = '🤖 Generated with [Claude Code](https://claude.com/claude-code)';
    const body = issue ? `Closes #${issue}\n\n${footer}` : footer;
    const pull = await api('POST', '/pulls', { head, base, title, body });
    console.log(`opened #${pull.number} ${pull.html_url}`);
}

async function listIssues() {
    const issues = [];
    for (let page = 1; ; page++) {
        const batch = await api('GET', `/issues?state=all&per_page=100&page=${page}`);
        issues.push(...batch);
        if (batch.length < 100) return issues;
    }
}

function findIssueLine(lines, headingIndex) {
    for (let i = headingIndex + 1; i < lines.length && !lines[i].startsWith('#'); i++) {
        if (lines[i].startsWith('- Issue:')) return i;
    }
    return -1;
}

function buildBody(lines, headingIndex) {
    const checklist = [];
    for (let i = headingIndex + 1; i < lines.length && !lines[i].startsWith('#'); i++) {
        if (lines[i].startsWith('- [')) checklist.push(lines[i]);
    }
    return `${checklist.join('\n')}\n\nProgress is tracked in Tasks.md.`;
}

async function api(method, path, body) {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'isequence-tasks' },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) fail(`${method} ${path} failed with ${response.status}: ${data.message ?? 'unknown error'}`);
    return data;
}

function resolveRepo() {
    const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (!match) fail(`origin is not a GitHub remote: ${url}`);
    return match[1];
}

function fail(message) {
    console.error(message);
    process.exit(1);
}
