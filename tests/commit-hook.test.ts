import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const hooksPath = path.resolve('.githooks');
let repo = '';
let counter = 0;

before(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'isequence-hook-'));
    git('init', '-q', '-b', 'master');
    git('config', 'user.name', 'Hook Test');
    git('config', 'user.email', 'hook@test.local');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', hooksPath);
});

after(() => {
    rmSync(repo, { recursive: true, force: true });
});

test('feat and fix branches get the issue number prefix', () => {
    assert.equal(commitOn('feat/12-failure-handling', 'Add cancel'), '[12] Add cancel');
    assert.equal(commitOn('fix/7-broken-resume', 'Fix resume'), '[7] Fix resume');
    assert.equal(commitOn('feat/3', 'Add types'), '[3] Add types');
});

test('an existing prefix is not added twice', () => {
    assert.equal(commitOn('feat/12-failure-handling', '[12] Already tagged'), '[12] Already tagged');
    assert.equal(commitOn('feat/12-failure-handling', '[4] Other issue'), '[4] Other issue');
});

test('other branches are left alone', () => {
    assert.equal(commitOn('master', 'Plain commit'), 'Plain commit');
    assert.equal(commitOn('chore/cleanup', 'Tidy up'), 'Tidy up');
    assert.equal(commitOn('feat/no-number', 'No issue'), 'No issue');
});

test('the message body is kept', () => {
    git('checkout', '-q', '-B', 'feat/9-video-api');
    writeFileSync(path.join(repo, 'file.txt'), `change ${++counter}\n`);
    git('add', 'file.txt');
    git('commit', '-q', '-m', 'Add route', '-m', 'Second paragraph');
    assert.equal(git('log', '-1', '--format=%B').trim(), '[9] Add route\n\nSecond paragraph');
});

test('merge commits are not prefixed', () => {
    git('checkout', '-q', '-B', 'feat/5-target', 'master');
    git('checkout', '-q', '-B', 'side');
    writeFileSync(path.join(repo, 'side.txt'), `side ${++counter}\n`);
    git('add', 'side.txt');
    git('commit', '-q', '-m', 'Side work');
    git('checkout', '-q', 'feat/5-target');
    git('merge', '-q', '--no-ff', '-m', 'Merge side', 'side');
    assert.equal(git('log', '-1', '--format=%s').trim(), 'Merge side');
});

function commitOn(branch: string, message: string) {
    git('checkout', '-q', '-B', branch);
    writeFileSync(path.join(repo, 'file.txt'), `change ${++counter}\n`);
    git('add', 'file.txt');
    git('commit', '-q', '-m', message);
    return git('log', '-1', '--format=%s').trim();
}

function git(...args: string[]) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
