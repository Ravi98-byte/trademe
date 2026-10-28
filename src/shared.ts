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
export type Library = {
  version: 1;
  entries: Entry[];
  questions?: ResearchQuestion[];
};
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DesktopAPI {
  updateStatus(): Promise<Result<UpdateState>>;
  checkForUpdates(): Promise<Result<UpdateState>>;
  downloadUpdate(): Promise<Result<UpdateState>>;
  installUpdate(): Promise<Result<UpdateState>>;
  listQuestions(): Promise<Result<ResearchQuestion[]>>;
  createQuestion(input: QuestionInput): Promise<Result<ResearchQuestion>>;
  replyToQuestion(
    id: string,
    content: string,
    source: string,
  ): Promise<Result<ResearchQuestion>>;
  copyQuestion(id: string): Promise<Result<void>>;
  deleteQuestion(id: string): Promise<Result<void>>;
  list(): Promise<Result<Entry[]>>;
  save(input: EntryInput, id?: string): Promise<Result<Entry>>;
  remove(id: string): Promise<Result<void>>;
  importText(): Promise<Result<{ title: string; content: string } | null>>;
  backup(): Promise<Result<string | null>>;
  storageInfo(): Promise<Result<string>>;
}

export type QuestionInput = { question: string; reason: string };
export type QuestionReply = {
  id: string;
  content: string;
  source: string;
  createdAt: string;
};
export type ResearchQuestion = QuestionInput & {
  id: string;
  origin: 'manual';
  createdAt: string;
  replies: QuestionReply[];
};

export type UpdateState = {
  phase:
    | 'unsupported'
    | 'idle'
    | 'checking'
    | 'available'
    | 'current'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error';
  currentVersion: string;
  version?: string;
  progress?: number;
  message: string;
};
