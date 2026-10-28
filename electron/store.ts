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
import { createReadStream, createWriteStream, constants } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import yazl from 'yazl';
import { sourceMetadata, validateSources } from './source-validation.js';
import { digestFile, type PreparedFile } from './source-files.js';
import { randomUUID } from 'node:crypto';
import {
  categories,
  evidenceKinds,
  type Entry,
  type EntryInput,
  type Library,
  type ResearchQuestion,
  type KnowledgeSource,
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
      validateSources(data.sources);
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
  listSources(): Promise<KnowledgeSource[]> {
    return this.serial(async () => (await this.read()).sources ?? []);
  }
  saveSourceLink(kind: unknown, raw: unknown): Promise<KnowledgeSource> {
    return this.serial(async () => {
      if (
        !['video-link', 'interview-link', 'web-link'].includes(kind as string)
      )
        throw new Error('Choose a supported link type.');
      const input = sourceMetadata(raw, true);
      const data = await this.read();
      const source: KnowledgeSource = {
        ...input,
        kind: kind as KnowledgeSource['kind'],
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      data.sources = [source, ...(data.sources ?? [])];
      validateSources(data.sources);
      await this.write(data);
      return source;
    });
  }
  saveSourceFile(
    prepared: PreparedFile,
    raw: unknown,
  ): Promise<KnowledgeSource> {
    return this.serial(async () => {
      const input = sourceMetadata(raw, false);
      const data = await this.read();
      const source: KnowledgeSource = {
        ...input,
        id: randomUUID(),
        kind: prepared.kind,
        createdAt: new Date().toISOString(),
        file: {
          name: `${prepared.sha256}.${prepared.extension}`,
          originalName: prepared.originalName,
          sha256: prepared.sha256,
          size: prepared.size,
        },
        ...(prepared.pages ? { pages: prepared.pages } : {}),
        ...(prepared.content ? { content: prepared.content } : {}),
      };
      validateSources([source]);
      const assets = join(this.directory, 'assets');
      await mkdir(assets, { recursive: true, mode: 0o700 });
      const temporary = join(assets, `${randomUUID()}.tmp`);
      const destination = join(assets, source.file!.name);
      try {
        const hash = createHash('sha256');
        let size = 0;
        const guard = new Transform({
          transform(chunk, _encoding, callback) {
            size += chunk.length;
            if (size > prepared.size) {
              callback(
                new Error('The original file changed. Choose it again.'),
              );
              return;
            }
            hash.update(chunk);
            callback(null, chunk);
          },
        });
        await pipeline(
          createReadStream(prepared.path),
          guard,
          createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
        );
        if (size !== prepared.size || hash.digest('hex') !== prepared.sha256)
          throw new Error('The original file changed. Choose it again.');
        try {
          await copyFile(temporary, destination, constants.COPYFILE_EXCL);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          if ((await digestFile(destination)) !== prepared.sha256)
            throw new Error(
              'An existing original file has changed. Restore it before importing a duplicate.',
            );
        }
        data.sources = [source, ...(data.sources ?? [])];
        await this.write(data);
        return source;
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    });
  }
  editSource(id: unknown, raw: unknown): Promise<KnowledgeSource> {
    return this.serial(async () => {
      const data = await this.read();
      const source = data.sources?.find((s) => s.id === id);
      if (!source) throw new Error('Source not found.');
      const input = sourceMetadata(raw, source.kind.endsWith('-link'));
      Object.assign(source, input);
      validateSources(data.sources);
      await this.write(data);
      return source;
    });
  }
  deleteSource(id: unknown): Promise<void> {
    return this.serial(async () => {
      const data = await this.read();
      if (!data.sources?.some((s) => s.id === id))
        throw new Error('Source not found.');
      data.sources = data.sources.filter((s) => s.id !== id);
      await this.write(data);
    });
  }
  async sourceFile(id: string): Promise<string> {
    const source = (await this.listSources()).find((s) => s.id === id);
    if (!source?.file) throw new Error('Original file not found.');
    const path = join(this.directory, 'assets', source.file.name);
    if ((await digestFile(path)) !== source.file.sha256)
      throw new Error(
        'Original file is missing or changed. Restore it from a complete backup.',
      );
    return path;
  }
  exportArchive(destination: string): Promise<void> {
    return this.serial(async () => {
      const data = await this.read();
      const temporary = `${destination}.${randomUUID()}.tmp`;
      const zip = new yazl.ZipFile();
      try {
        const assets = new Map(
          (data.sources ?? [])
            .filter((s) => s.file)
            .map((s) => [s.file!.name, s.file!]),
        );
        for (const [name, file] of assets) {
          const path = join(this.directory, 'assets', name);
          if ((await digestFile(path)) !== file.sha256)
            throw new Error(
              'An original file is missing or changed. Backup stopped.',
            );
        }
        zip.addBuffer(
          Buffer.from(JSON.stringify(data, null, 2)),
          'library.json',
        );
        for (const [name] of assets)
          zip.addFile(join(this.directory, 'assets', name), `assets/${name}`, {
            compress: false,
          });
        const output = createWriteStream(temporary, {
          flags: 'wx',
          mode: 0o600,
        });
        const done = pipeline(zip.outputStream, output);
        zip.on('error', (error) =>
          (zip.outputStream as Readable).destroy(error),
        );
        zip.end();
        await done;
        await rename(temporary, destination);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
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
