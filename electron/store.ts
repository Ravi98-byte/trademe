import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  readdir,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  categories,
  evidenceKinds,
  type Entry,
  type EntryInput,
  type Library,
} from '../src/shared.js';

export function validateInput(value: unknown): EntryInput {
  if (!value || typeof value !== 'object') throw new Error('Invalid entry.');
  const v = value as Record<string, unknown>;
  const keys = [
    'title',
    'content',
    'author',
    'source',
    'sourceDate',
    'locator',
    'permission',
    'category',
    'evidence',
  ] as const;
  const result = {} as EntryInput;
  for (const key of keys) {
    if (
      typeof v[key] !== 'string' ||
      (v[key] as string).length > (key === 'content' ? 500_000 : 2000)
    )
      throw new Error(`Invalid ${key}.`);
    (result as Record<string, string>)[key] = (v[key] as string).trim();
  }
  if (!result.title || !result.content || !result.permission)
    throw new Error(
      'Title, note content, and rights or permission are required.',
    );
  if (
    !categories.includes(result.category) ||
    !evidenceKinds.includes(result.evidence)
  )
    throw new Error('Choose a valid category and evidence type.');
  if (
    result.sourceDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result.sourceDate) ||
      !Number.isFinite(Date.parse(result.sourceDate)) ||
      new Date(result.sourceDate).toISOString().slice(0, 10) !==
        result.sourceDate)
  )
    throw new Error('Enter a valid source date.');
  return result;
}

export class LibraryStore {
  private queue: Promise<unknown> = Promise.resolve();
  readonly file: string;
  constructor(readonly directory: string) {
    this.file = join(directory, 'library.json');
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async read(): Promise<Library> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return { version: 1, entries: [] };
      throw e;
    }
    let data: Library;
    try {
      data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error();
      const ids = new Set<string>();
      for (const entry of data.entries) {
        validateInput(entry);
        if (
          typeof entry.id !== 'string' ||
          !entry.id ||
          ids.has(entry.id) ||
          !Number.isFinite(Date.parse(entry.createdAt)) ||
          !Number.isFinite(Date.parse(entry.updatedAt))
        )
          throw new Error();
        ids.add(entry.id);
      }
    } catch {
      throw new Error(
        'The library could not be read. Your file has been preserved. Restore a verified backup before continuing.',
      );
    }
    return data;
  }
  private async write(data: Library): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const backups = join(this.directory, 'backups');
    await mkdir(backups, { recursive: true, mode: 0o700 });
    try {
      await copyFile(
        this.file,
        join(backups, `library-${Date.now()}-${randomUUID()}.json`),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(data, null, 2), {
        mode: 0o600,
        flag: 'wx',
      });
      await rename(temporary, this.file);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    const names = (await readdir(backups))
      .filter((n) => /^library-\d+-[a-f0-9-]+\.json$/.test(n))
      .sort()
      .reverse();
    await Promise.all(names.slice(20).map((n) => unlink(join(backups, n))));
  }
  list(): Promise<Entry[]> {
    return this.serial(async () => (await this.read()).entries);
  }
  save(raw: unknown, id?: string): Promise<Entry> {
    return this.serial(async () => {
      const input = validateInput(raw);
      const data = await this.read();
      const existing = id ? data.entries.find((e) => e.id === id) : undefined;
      if (id && !existing)
        throw new Error('This entry no longer exists. Reload the library.');
      const now = new Date().toISOString();
      const entry: Entry = {
        ...input,
        id: existing?.id ?? randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      data.entries = [entry, ...data.entries.filter((e) => e.id !== entry.id)];
      await this.write(data);
      return entry;
    });
  }
  remove(id: string): Promise<void> {
    return this.serial(async () => {
      const data = await this.read();
      if (!data.entries.some((e) => e.id === id))
        throw new Error('Entry not found.');
      data.entries = data.entries.filter((e) => e.id !== id);
      await this.write(data);
    });
  }
  export(destination: string): Promise<void> {
    return this.serial(async () => {
      const data = await this.read();
      await writeFile(destination, JSON.stringify(data, null, 2), {
        mode: 0o600,
      });
    });
  }
}
