import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  getDocument,
  GlobalWorkerOptions,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfRoot = dirname(
  createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(pdfRoot, 'legacy', 'build', 'pdf.worker.mjs'),
).href;
class LocalBinaryFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const folder = (
      {
        cMapUrl: 'cmaps',
        standardFontDataUrl: 'standard_fonts',
        wasmUrl: 'wasm',
      } as Record<string, string>
    )[kind];
    if (
      !folder ||
      typeof filename !== 'string' ||
      !/^[a-zA-Z0-9_.-]+$/.test(filename) ||
      filename.includes('..')
    )
      throw new Error('Unsupported PDF resource.');
    return new Uint8Array(await readFile(join(pdfRoot, folder, filename)));
  }
}
async function extract(path: string) {
  const bytes = await readFile(path);
  if (
    bytes.length > 25 * 1024 * 1024 ||
    !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))
  )
    throw new Error('Choose a valid PDF under 25 MB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const loading = getDocument({
    data: new Uint8Array(bytes),
    BinaryDataFactory: LocalBinaryFactory,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
  });
  try {
    const doc = await loading.promise;
    if (doc.numPages > 1500)
      throw new Error('PDF limit is 1,500 pages per file.');
    const pages = [];
    let total = 0;
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
        )
        .join('')
        .trim();
      total += text.length;
      if (total > 8_000_000)
        throw new Error(
          'PDF contains too much text. Split it into smaller documents.',
        );
      pages.push({ number, text });
      page.cleanup();
    }
    if (!pages.some((p) => p.text.trim()))
      throw new Error(
        'No readable text found. This PDF may be scanned; OCR is not supported yet.',
      );
    return { ok: true, pages, sha256, size: bytes.length };
  } finally {
    await loading.destroy();
  }
}
const utilityPort = (
  process as typeof process & {
    parentPort?: {
      on: (
        event: string,
        callback: (message: { data: { path: string } }) => void,
      ) => void;
      postMessage: (value: unknown) => void;
    };
  }
).parentPort;
async function run(path: string) {
  const send = (value: unknown) =>
    utilityPort
      ? utilityPort.postMessage(value)
      : parentPort!.postMessage(value);
  try {
    send(await extract(path));
  } catch (error) {
    send({
      ok: false,
      error:
        (error as Error)?.name === 'PasswordException'
          ? 'Password-protected PDFs are not supported.'
          : error instanceof Error
            ? error.message
            : 'PDF could not be read.',
    });
  }
}
if (utilityPort)
  utilityPort.on('message', (message) => {
    void run(message.data.path);
  });
else void run(workerData.path);
