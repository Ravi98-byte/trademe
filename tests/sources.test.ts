import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  copyFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { unzipSync } from 'fflate';
import { LibraryStore } from '../electron/store.js';
import { prepareFile } from '../electron/source-files.js';
import {
  sourceMetadata,
  validateSources,
} from '../electron/source-validation.js';
const { makePdf } = createRequire(import.meta.url)('./fixtures/pdf.cjs');
const meta = {
  title: 'Source title',
  author: 'Ravi',
  url: 'https://example.com/interview',
  permission: 'My original test material',
  notes: 'My own interpretation, not the original text.',
};
async function fixture(
  action: (store: LibraryStore, dir: string) => Promise<void>,
) {
  const dir = await mkdtemp(join(tmpdir(), 'trademe-sources-'));
  try {
    await action(new LibraryStore(join(dir, 'knowledge')), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test('PDF worker extracts real text with physical page references and keeps the original', () =>
  fixture(async (store, dir) => {
    const pdf = makePdf();
    const path = join(dir, 'research.pdf');
    await writeFile(path, pdf);
    const prepared = await prepareFile(path, 'pdf');
    assert.equal(prepared.pages?.length, 2);
    assert.match(prepared.pages![0].text, /Opening range/);
    assert.match(prepared.pages![1].text, /slippage/);
    assert.equal(prepared.pages![1].number, 2);
    const source = await store.saveSourceFile(prepared, meta);
    assert.equal(source.pages?.length, 2);
    assert.deepEqual(await readFile(await store.sourceFile(source.id)), pdf);
    assert.equal(
      (await new LibraryStore(store.directory).listSources())[0].file?.sha256,
      source.file?.sha256,
    );
  }));
test('no-text, corrupt, unsupported, and over-limit files fail without creating records', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'blank.pdf');
    await writeFile(path, makePdf(['']));
    await assert.rejects(() => prepareFile(path, 'pdf'), /No readable text/);
    await writeFile(path, 'not pdf');
    await assert.rejects(() => prepareFile(path, 'pdf'), /valid PDF/);
    const wrong = join(dir, 'file.exe');
    await writeFile(wrong, 'data');
    await assert.rejects(() => prepareFile(wrong, 'video-file'), /supported/);
    const large = join(dir, 'long.txt');
    await writeFile(large, 'x'.repeat(500001));
    await assert.rejects(() => prepareFile(large, 'transcript'), /500 KB/);
    assert.deepEqual(await store.listSources(), []);
  }));
test('link records do not pretend to contain fetched content and unsafe schemes are rejected', () =>
  fixture(async (store) => {
    const source = await store.saveSourceLink('video-link', meta);
    assert.equal(source.file, undefined);
    assert.equal(source.content, undefined);
    assert.equal(source.pages, undefined);
    for (const url of [
      'javascript:alert(1)',
      'file:///private',
      'https://user:password@example.com',
      'not-a-url',
    ])
      await assert.rejects(() =>
        store.saveSourceLink('web-link', { ...meta, url }),
      );
    await assert.rejects(() => store.saveSourceLink('invented-kind', meta));
    await assert.rejects(() =>
      store.saveSourceLink('web-link', { ...meta, permission: ' ' }),
    );
  }));
test('transcript timestamps and separate annotations survive ZIP backup and restore', () =>
  fixture(async (store, dir) => {
    const text = '00:12:30 Research idea.\n00:14:00 Needs testing.';
    const path = join(dir, 'interview.vtt');
    await writeFile(path, text);
    const source = await store.saveSourceFile(
      await prepareFile(path, 'transcript'),
      meta,
    );
    const backup = join(dir, 'backup.zip');
    await store.exportArchive(backup);
    const files = unzipSync(await readFile(backup));
    assert.equal(
      new TextDecoder().decode(files[`assets/${source.file!.name}`]),
      text,
    );
    const data = JSON.parse(new TextDecoder().decode(files['library.json']));
    assert.equal(data.sources[0].content, text);
    assert.equal(data.sources[0].notes, meta.notes);
    const restored = join(dir, 'restored');
    await mkdir(join(restored, 'assets'), { recursive: true });
    await writeFile(join(restored, 'library.json'), files['library.json']);
    await writeFile(
      join(restored, 'assets', source.file!.name),
      files[`assets/${source.file!.name}`],
    );
    const reopened = new LibraryStore(restored);
    assert.deepEqual(await reopened.listSources(), [source]);
    assert.equal(
      await readFile(await reopened.sourceFile(source.id), 'utf8'),
      text,
    );
  }));
test('video file is copied and preserved without invented text or transcription', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.mp4');
    const video = Buffer.from('local video fixture, not a decoded video');
    await writeFile(path, video);
    const source = await store.saveSourceFile(
      await prepareFile(path, 'video-file'),
      meta,
    );
    assert.equal(source.kind, 'video-file');
    assert.equal(source.pages, undefined);
    assert.equal(source.content, undefined);
    assert.deepEqual(await readFile(await store.sourceFile(source.id)), video);
  }));
test('changed originals are rejected between selection and saving', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.txt');
    await writeFile(path, 'first');
    const prepared = await prepareFile(path, 'transcript');
    await writeFile(path, 'other');
    await assert.rejects(() => store.saveSourceFile(prepared, meta), /changed/);
    assert.deepEqual(await store.listSources(), []);
  }));
test('tampered stored assets prevent opening and complete backup, preserving existing export', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.txt');
    await writeFile(path, 'first');
    const source = await store.saveSourceFile(
      await prepareFile(path, 'transcript'),
      meta,
    );
    await writeFile(
      join(store.directory, 'assets', source.file!.name),
      'other',
    );
    await assert.rejects(() => store.sourceFile(source.id), /changed/);
    const archive = join(dir, 'keep.zip');
    await writeFile(archive, 'previous export');
    await assert.rejects(() => store.exportArchive(archive), /changed/);
    assert.equal(await readFile(archive, 'utf8'), 'previous export');
  }));
test('source deletion retains assets for earlier backups and corrupted paths cannot escape', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.txt');
    await writeFile(path, 'first');
    const source = await store.saveSourceFile(
      await prepareFile(path, 'transcript'),
      meta,
    );
    await store.deleteSource(source.id);
    assert.deepEqual(await store.listSources(), []);
    assert.equal(
      await readFile(
        join(store.directory, 'assets', source.file!.name),
        'utf8',
      ),
      'first',
    );
    assert.throws(() =>
      validateSources([
        { ...source, file: { ...source.file, name: '../../outside.txt' } },
      ]),
    );
    await assert.rejects(() =>
      store.saveSourceLink('web-link', { ...meta, url: '' }),
    );
  }));
test('source metadata cannot overwrite old notes or chat and corrupt sources preserve the library', () =>
  fixture(async (store, dir) => {
    await store.createQuestion({ question: 'Question', reason: 'Reason' });
    await store.saveSourceLink('interview-link', meta);
    assert.equal((await store.listQuestions()).length, 1);
    const bad = JSON.stringify({
      version: 1,
      entries: [],
      sources: [{ kind: 'pdf' }],
    });
    await writeFile(store.file, bad);
    await assert.rejects(
      () => store.createQuestion({ question: 'Q', reason: 'R' }),
      /preserved/,
    );
    assert.equal(await readFile(store.file, 'utf8'), bad);
  }));

test('editing source details preserves original text, file identity, and other sources', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.txt');
    await writeFile(path, 'Original transcript text');
    const original = await store.saveSourceFile(
      await prepareFile(path, 'transcript'),
      meta,
    );
    const updated = await store.editSource(original.id, {
      ...meta,
      title: 'Updated source',
      sourceDate: '2026-10-27',
      locator: '00:12:30',
    });
    assert.equal(updated.file?.sha256, original.file?.sha256);
    assert.equal(updated.content, original.content);
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(updated.sourceDate, '2026-10-27');
    await assert.rejects(
      () =>
        store.editSource(original.id, { ...meta, sourceDate: '2026-02-30' }),
      /valid source date/,
    );
  }));

test('duplicate source records share an intact asset and export it only once', () =>
  fixture(async (store, dir) => {
    const path = join(dir, 'lesson.txt');
    await writeFile(path, 'Shared original');
    const prepared = await prepareFile(path, 'transcript');
    const first = await store.saveSourceFile(prepared, meta);
    const second = await store.saveSourceFile(prepared, {
      ...meta,
      title: 'Second reference',
    });
    assert.notEqual(first.id, second.id);
    assert.equal(first.file?.name, second.file?.name);
    const archive = join(dir, 'duplicates.zip');
    await store.exportArchive(archive);
    assert.equal(Object.keys(unzipSync(await readFile(archive))).length, 2);
  }));
