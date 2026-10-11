import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createImage, deleteImage, listImages } from '../server/store/images';
import { countSavedFrames, createVideo, deleteVideo, getVideo, listVideos, readFrame, saveFrame, updateVideo } from '../server/store/videos';

const dir = mkdtempSync(path.join(tmpdir(), 'isequence-'));
process.env.DATA_DIR = dir;

after(() => rmSync(dir, { recursive: true, force: true }));

test('video lifecycle', async () => {
    const video = await createVideo('Sunrise', 'a sunrise over the sea', 3);
    assert.equal(video.status, 'queued');
    assert.deepEqual(await getVideo(video.id), video);

    await saveFrame(video.id, { index: 1, svg: '<svg/>', png: Buffer.from('one') });
    await saveFrame(video.id, { index: 2, svg: '<svg/>', png: Buffer.from('two') });
    assert.equal(await countSavedFrames(video.id, 3), 2);
    assert.equal((await readFrame(video.id, 2)).png.toString(), 'two');

    const updated = await updateVideo(video.id, { status: 'generating', framesDone: 2 });
    assert.equal(updated.framesDone, 2);
    assert.equal((await listVideos()).length, 1);

    await deleteVideo(video.id);
    assert.equal(await getVideo(video.id), null);
    assert.deepEqual(await listVideos(), []);
});

test('invalid ids are rejected', async () => {
    assert.equal(await getVideo('../../etc'), null);
    await assert.rejects(() => deleteVideo('..'));
    await assert.rejects(() => deleteImage('../x'));
});

test('image lifecycle', async () => {
    const image = await createImage('a red fox', '<svg/>', Buffer.from('png'));
    assert.deepEqual(await listImages(), [image]);
    await deleteImage(image.id);
    assert.deepEqual(await listImages(), []);
});
