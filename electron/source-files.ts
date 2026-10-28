import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { stat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { SourcePage } from '../src/shared.js';
export type PreparedFile = {
  path: string;
  originalName: string;
  extension: string;
  sha256: string;
  size: number;
  kind: 'pdf' | 'transcript' | 'video-file';
  pages?: SourcePage[];
  content?: string;
};
export async function digestFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function prepareFile(
  path: string,
  kind: PreparedFile['kind'],
): Promise<PreparedFile> {
  const extension = extname(path).toLowerCase().slice(1);
  const info = await stat(path);
  const limit =
    kind === 'pdf'
      ? 25 * 1024 * 1024
      : kind === 'transcript'
        ? 500000
        : 500 * 1024 * 1024;
  const valid =
    kind === 'pdf'
      ? ['pdf']
      : kind === 'transcript'
        ? ['txt', 'md', 'srt', 'vtt']
        : ['mp4', 'm4v', 'mov', 'webm', 'mkv'];
  if (
    !info.isFile() ||
    !valid.includes(extension) ||
    info.size <= 0 ||
    info.size > limit
  )
    throw new Error(
      `Choose a supported ${kind} file under ${kind === 'pdf' ? '25 MB' : kind === 'transcript' ? '500 KB' : '500 MB'}.`,
    );
  const base = {
    path,
    originalName: basename(path),
    extension,
    size: info.size,
    kind,
  };
  if (kind === 'pdf') {
    const result = await extractPdf(path);
    return { ...base, ...result };
  }
  if (kind === 'transcript') {
    const bytes = await readFile(path);
    if (bytes.length > limit) throw new Error('Transcript exceeds 500 KB.');
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('Use a UTF-8 plain text transcript.');
    }
    if (!content.trim() || content.includes('\0'))
      throw new Error('Transcript must contain readable plain text.');
    return {
      ...base,
      size: bytes.length,
      content,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return { ...base, sha256: await digestFile(path) };
}

async function extractPdf(
  path: string,
): Promise<{ pages: SourcePage[]; sha256: string; size: number }> {
  const url = new URL(
    import.meta.url.endsWith('.ts') ? './pdf-worker.ts' : './pdf-worker.js',
    import.meta.url,
  );
  if (process.versions.electron) {
    const { utilityProcess } = await import('electron');
    return new Promise((resolve, reject) => {
      const child = utilityProcess.fork(fileURLToPath(url), [], {
        serviceName: 'TradeMe PDF reader',
        stdio: 'ignore',
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('PDF extraction timed out. Try a smaller document.'));
      }, 45000);
      child.once('spawn', () => child.postMessage({ path }));
      child.once('message', (r) => {
        clearTimeout(timer);
        child.kill();
        r.ok ? resolve(r) : reject(new Error(r.error));
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(
          new Error(
            'PDF reader stopped before completing. The source has not been imported.',
          ),
        );
      });
    });
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, { workerData: { path } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error('PDF extraction timed out. Try a smaller document.'));
    }, 45000);
    worker.once('message', (r) => {
      clearTimeout(timer);
      void worker.terminate();
      r.ok ? resolve(r) : reject(new Error(r.error));
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(
        new Error(
          'PDF reader could not start. Please report this import error.',
        ),
      );
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('PDF reader stopped before completing.'));
    });
  });
}
