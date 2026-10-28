import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  mkdir,
  copyFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStore, validateInput } from '../electron/store.js';
import type { EntryInput } from '../src/shared.js';
const note: EntryInput = {
  title: 'Opening range hypothesis',
  content: 'Test before drawing conclusions.',
  author: 'Ravi',
  source: 'Original observation',
  sourceDate: '2026-10-27',
  locator: 'Session notes',
  permission: 'My original writing',
  category: 'Strategy',
  evidence: 'Personal note',
};
async function fixture(
  run: (store: LibraryStore, directory: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'trademe-test-'));
  try {
    await run(new LibraryStore(directory), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test('creates an empty library without fabricating notes', () =>
  fixture(async (store) => {
    assert.deepEqual(await store.list(), []);
  }));
test('preserves source metadata across save, restart, and edit', () =>
  fixture(async (store, directory) => {
    const saved = await store.save(note);
    const reopened = new LibraryStore(directory);
    assert.deepEqual(await reopened.list(), [saved]);
    const edited = await reopened.save(
      { ...note, title: 'Revised hypothesis' },
      saved.id,
    );
    assert.equal(edited.id, saved.id);
    assert.equal(edited.createdAt, saved.createdAt);
    assert.equal(edited.permission, note.permission);
    assert.equal((await reopened.list()).length, 1);
  }));
test('serializes concurrent writes without losing notes', () =>
  fixture(async (store) => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        store.save({ ...note, title: `Note ${i}` }),
      ),
    );
    const notes = await store.list();
    assert.equal(notes.length, 12);
    assert.equal(new Set(notes.map((n) => n.id)).size, 12);
  }));
test('backs up the previous state before editing or deleting', () =>
  fixture(async (store, directory) => {
    const saved = await store.save(note);
    await store.remove(saved.id);
    assert.deepEqual(await store.list(), []);
    const backups = await readdir(join(directory, 'backups'));
    assert.equal(backups.length, 1);
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, 'backups', backups[0]), 'utf8'))
        .entries,
      [saved],
    );
  }));
test('retains only the last 20 automatic versions', () =>
  fixture(async (store, directory) => {
    const saved = await store.save(note);
    for (let i = 0; i < 23; i++)
      await store.save({ ...note, title: `Version ${i}` }, saved.id);
    assert.equal((await readdir(join(directory, 'backups'))).length, 20);
  }));
test('exports a backup that can be read as a fresh library', () =>
  fixture(async (store, directory) => {
    const saved = await store.save(note);
    const destination = join(directory, 'export.json');
    await store.export(destination);
    assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), {
      version: 1,
      entries: [saved],
    });
    const restoredDir = join(directory, 'restored');
    await mkdir(restoredDir);
    await copyFile(destination, join(restoredDir, 'library.json'));
    assert.deepEqual(await new LibraryStore(restoredDir).list(), [saved]);
  }));
test('refuses to overwrite corrupt data or unsupported schema versions', () =>
  fixture(async (store, directory) => {
    for (const bad of ['{broken', '{"version":2,"entries":[]}']) {
      await writeFile(store.file, bad);
      await assert.rejects(() => store.save(note), /preserved/);
      assert.equal(await readFile(store.file, 'utf8'), bad);
    }
  }));
test('rejects duplicate IDs and invalid entry metadata in stored files', () =>
  fixture(async (store) => {
    const saved = await store.save(note);
    await writeFile(
      store.file,
      JSON.stringify({ version: 1, entries: [saved, saved] }),
    );
    await assert.rejects(() => store.list(), /preserved/);
  }));
test('validates required content, permissions, types, size, and real dates', () => {
  for (const input of [
    { ...note, title: ' ' },
    { ...note, permission: '' },
    { ...note, category: 'Unknown' },
    { ...note, content: 'x'.repeat(500001) },
    { ...note, author: 42 },
    { ...note, sourceDate: '2026-02-30' },
  ])
    assert.throws(() => validateInput(input));
  assert.deepEqual(validateInput(note), note);
});
test('failed mutations do not poison subsequent valid operations', () =>
  fixture(async (store) => {
    await assert.rejects(() => store.save({ ...note, permission: '' }));
    const saved = await store.save(note);
    await assert.rejects(() => store.save(note, 'missing'), /no longer exists/);
    assert.deepEqual(await store.list(), [saved]);
  }));
