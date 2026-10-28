import type {
  KnowledgeSource,
  SourceKind,
  SourceMetadata,
} from '../src/shared.js';
export const sourceKinds: SourceKind[] = [
  'pdf',
  'transcript',
  'video-file',
  'video-link',
  'interview-link',
  'web-link',
];
export function sourceMetadata(raw: unknown, linked: boolean): SourceMetadata {
  if (!raw || typeof raw !== 'object')
    throw new Error('Invalid source metadata.');
  const data = raw as Record<string, unknown>;
  const result = {} as SourceMetadata;
  for (const key of [
    'title',
    'author',
    'url',
    'permission',
    'notes',
  ] as const) {
    if (
      typeof data[key] !== 'string' ||
      data[key].length > (key === 'notes' ? 50000 : 2000)
    )
      throw new Error(`Invalid source ${key}.`);
    result[key] = data[key].trim();
  }
  for (const key of ['sourceDate', 'locator'] as const) {
    if (
      data[key] !== undefined &&
      (typeof data[key] !== 'string' || data[key].length > 2000)
    )
      throw new Error(`Invalid source ${key}.`);
    if (typeof data[key] === 'string') result[key] = data[key].trim();
  }
  if (
    result.sourceDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result.sourceDate) ||
      !Number.isFinite(Date.parse(result.sourceDate)) ||
      new Date(result.sourceDate).toISOString().slice(0, 10) !==
        result.sourceDate)
  )
    throw new Error('Enter a valid source date.');
  if (!result.title || !result.permission)
    throw new Error('A source title and rights / permission are required.');
  if (linked && !result.url) throw new Error('A source link is required.');
  if (result.url) {
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      throw new Error('Enter a complete http:// or https:// link.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Use an HTTP(S) link without embedded credentials.');
  }
  return result;
}
export function validateSources(
  raw: unknown,
): asserts raw is KnowledgeSource[] | undefined {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) throw new Error('Invalid source records.');
  const ids = new Set<string>();
  for (const s of raw) {
    if (
      !s ||
      typeof s !== 'object' ||
      !sourceKinds.includes(s.kind) ||
      typeof s.id !== 'string' ||
      !s.id ||
      ids.has(s.id) ||
      typeof s.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(s.createdAt))
    )
      throw new Error('Invalid source record.');
    ids.add(s.id);
    const linked = s.kind.endsWith('-link');
    sourceMetadata(s, linked);
    if (linked) {
      if (s.file || s.pages || s.content)
        throw new Error('Link content has not been imported.');
      continue;
    }
    if (
      !s.file ||
      typeof s.file.originalName !== 'string' ||
      s.file.originalName.length > 2000 ||
      !/^[a-f0-9]{64}$/.test(s.file.sha256) ||
      !/^[a-f0-9]{64}\.(pdf|txt|md|srt|vtt|mp4|m4v|mov|mkv|webm)$/.test(
        s.file.name,
      ) ||
      !s.file.name.startsWith(s.file.sha256 + '.') ||
      !Number.isInteger(s.file.size) ||
      s.file.size <= 0 ||
      s.file.size > 500 * 1024 * 1024
    )
      throw new Error('Invalid source file.');
    const ext = s.file.name.split('.').pop();
    if (s.kind === 'pdf') {
      if (
        ext !== 'pdf' ||
        !Array.isArray(s.pages) ||
        !s.pages.length ||
        s.pages.length > 1500 ||
        s.content !== undefined
      )
        throw new Error('Invalid PDF pages.');
      let chars = 0;
      for (const [i, p] of s.pages.entries()) {
        if (p.number !== i + 1 || typeof p.text !== 'string')
          throw new Error('Invalid PDF page.');
        chars += p.text.length;
      }
      if (chars > 8_000_000 || !chars) throw new Error('Invalid PDF text.');
    } else if (s.kind === 'transcript') {
      if (
        !['txt', 'md', 'srt', 'vtt'].includes(ext!) ||
        typeof s.content !== 'string' ||
        !s.content.trim() ||
        s.content.length > 500000 ||
        s.pages !== undefined
      )
        throw new Error('Invalid transcript.');
    } else if (
      !['mp4', 'm4v', 'mov', 'mkv', 'webm'].includes(ext!) ||
      s.content !== undefined ||
      s.pages !== undefined
    )
      throw new Error('Invalid video source.');
  }
}
