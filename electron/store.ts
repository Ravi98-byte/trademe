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
  type ResearchQuestion,
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
      validateQuestions(data.questions);
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
  listQuestions(): Promise<ResearchQuestion[]> {
    return this.serial(async () => (await this.read()).questions ?? []);
  }
  createQuestion(raw: unknown): Promise<ResearchQuestion> {
    return this.serial(async () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid question.');
      const input = raw as Record<string, unknown>;
      const question = text(input.question, 'Question', 10000);
      const reason = text(input.reason, 'Reason', 10000);
      const data = await this.read();
      const thread: ResearchQuestion = {
        id: randomUUID(),
        question,
        reason,
        origin: 'manual',
        createdAt: new Date().toISOString(),
        replies: [],
      };
      data.questions = [thread, ...(data.questions ?? [])];
      await this.write(data);
      return thread;
    });
  }
  replyToQuestion(
    id: unknown,
    content: unknown,
    source: unknown,
  ): Promise<ResearchQuestion> {
    return this.serial(async () => {
      const answer = text(content, 'Reply', 50000);
      const reference = text(source, 'Source', 2000, true);
      const data = await this.read();
      const thread = data.questions?.find((q) => q.id === id);
      if (!thread) throw new Error('Question not found.');
      thread.replies.push({
        id: randomUUID(),
        content: answer,
        source: reference,
        createdAt: new Date().toISOString(),
      });
      await this.write(data);
      return thread;
    });
  }
  deleteQuestion(id: unknown): Promise<void> {
    return this.serial(async () => {
      const data = await this.read();
      if (!data.questions?.some((q) => q.id === id))
        throw new Error('Question not found.');
      data.questions = data.questions.filter((q) => q.id !== id);
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

function text(
  value: unknown,
  name: string,
  limit: number,
  optional = false,
): string {
  if (
    typeof value !== 'string' ||
    value.length > limit ||
    (!optional && !value.trim())
  )
    throw new Error(
      `${name} must contain ${optional ? 'at most' : '1 to'} ${limit} characters.`,
    );
  return value.trim();
}
function validateQuestions(value: unknown): void {
  if (value === undefined) return; // Existing v1 libraries need no destructive migration.
  if (!Array.isArray(value)) throw new Error('Invalid questions.');
  const ids = new Set<string>();
  const identify = (item: Record<string, unknown>) => {
    const id = text(item.id, 'ID', 100);
    if (
      ids.has(id) ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt))
    )
      throw new Error('Invalid question metadata.');
    ids.add(id);
  };
  for (const q of value) {
    if (!q || typeof q !== 'object') throw new Error('Invalid question.');
    identify(q);
    text(q.question, 'Question', 10000);
    text(q.reason, 'Reason', 10000);
    if (q.origin !== 'manual' || !Array.isArray(q.replies))
      throw new Error('Unsupported question origin or replies.');
    for (const r of q.replies) {
      if (!r || typeof r !== 'object') throw new Error('Invalid reply.');
      identify(r);
      text(r.content, 'Reply', 50000);
      text(r.source, 'Source', 2000, true);
    }
  }
}
