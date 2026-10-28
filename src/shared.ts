export const categories = [
  'Market structure',
  'Strategy',
  'Risk & rules',
  'Psychology',
  'Research notes',
] as const;
export const evidenceKinds = [
  'Personal note',
  'Author opinion',
  'Source claim',
  'Test result',
] as const;
export type Entry = {
  id: string;
  title: string;
  content: string;
  author: string;
  source: string;
  sourceDate: string;
  locator: string;
  permission: string;
  category: (typeof categories)[number];
  evidence: (typeof evidenceKinds)[number];
  createdAt: string;
  updatedAt: string;
};
export type EntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;
export type Library = { version: 1; entries: Entry[] };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DesktopAPI {
  list(): Promise<Result<Entry[]>>;
  save(input: EntryInput, id?: string): Promise<Result<Entry>>;
  remove(id: string): Promise<Result<void>>;
  importText(): Promise<Result<{ title: string; content: string } | null>>;
  backup(): Promise<Result<string | null>>;
  storageInfo(): Promise<Result<string>>;
}
