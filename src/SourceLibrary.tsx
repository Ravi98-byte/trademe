import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  Film,
  Link2,
  Search,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import type {
  DesktopAPI,
  KnowledgeSource,
  PreparedSource,
  Result,
  SourceKind,
  SourceMetadata,
} from './shared';
const names: Record<SourceKind, string> = {
  pdf: 'PDF document',
  transcript: 'Transcript',
  'video-file': 'Video file',
  'video-link': 'Video link',
  'interview-link': 'Interview link',
  'web-link': 'Web link',
};
const empty: SourceMetadata = {
  sourceDate: '',
  locator: '',
  title: '',
  author: '',
  url: '',
  permission: '',
  notes: '',
};
function status(s: KnowledgeSource) {
  return s.kind === 'pdf'
    ? `${s.pages!.length} pages · Text extracted`
    : s.kind === 'transcript'
      ? 'Transcript text imported'
      : s.kind === 'video-file'
        ? 'Stored locally · Transcript needed'
        : 'Link saved · Content not retrieved';
}
async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const r = await promise;
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
export function SourceLibrary({
  api,
  onChanged,
}: {
  api?: DesktopAPI;
  onChanged: () => void;
}) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<{
    kind: SourceKind;
    file?: PreparedSource;
    edit?: KnowledgeSource;
  } | null>(null);
  const [metadata, setMetadata] = useState<SourceMetadata>({ ...empty });
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    if (api) setSources(await unwrap(api.listSources()));
  }
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (draft) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [draft]);
  const current = sources.find((s) => s.id === selected);
  const q = query.trim().toLowerCase();
  useEffect(() => {
    setPage(
      current?.pages?.find((p) => q && p.text.toLowerCase().includes(q))
        ?.number ?? 1,
    );
  }, [selected, q]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    if (busy) return;
    if (draft?.file && api) await api.cancelSource(draft.file.token);
    setDraft(null);
    setError('');
  }
  const filtered = sources.filter(
    (s) =>
      (kindFilter === 'all' || s.kind === kindFilter) &&
      (!q ||
        [
          s.title,
          s.author,
          s.url,
          s.notes,
          s.locator ?? '',
          s.content ?? '',
        ].some((v) => v.toLowerCase().includes(q)) ||
        s.pages?.some((p) => p.text.toLowerCase().includes(q))),
  );
  function prepare(kind: 'pdf' | 'video-file' | 'transcript') {
    void run(async () => {
      const file = await unwrap(api!.prepareSource(kind));
      if (file) {
        setMetadata({ ...empty, title: file.title });
        setDraft({ kind, file });
      }
    });
  }
  const matches =
    current?.pages?.filter((p) => q && p.text.toLowerCase().includes(q)) ?? [];
  return (
    <section className="source-library" aria-label="Documents and media">
      <div className="source-imports">
        <div>
          <h2>Build your source library</h2>
          <p>
            Keep original material, its source, and your own notes together.
          </p>
        </div>
        <div className="source-actions">
          <button
            className="button primary"
            disabled={!api || busy || loading}
            onClick={() => prepare('pdf')}
          >
            <FileText size={15} />
            Import PDF
          </button>
          <button
            className="button secondary"
            disabled={!api || busy || loading}
            onClick={() => prepare('video-file')}
          >
            <Film size={15} />
            Import video
          </button>
          <button
            className="button secondary"
            disabled={!api || busy || loading}
            onClick={() => prepare('transcript')}
          >
            Import transcript
          </button>
          <button
            className="button secondary"
            disabled={!api || busy || loading}
            onClick={() => {
              setMetadata({ ...empty });
              setDraft({ kind: 'video-link' });
              setError('');
            }}
          >
            <Link2 size={15} />
            Add link
          </button>
        </div>
      </div>
      <div className="quiet-callout source-explanation">
        PDF text and transcripts are searchable locally. Video files are stored,
        and links are bookmarked; neither is watched, downloaded, or transcribed
        automatically. No AI is connected yet. Scanned PDFs need OCR, which is
        not supported in this version.
      </div>
      {error && !draft && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="alert success">
          {notice}
        </div>
      )}
      {busy && !draft && (
        <p role="status" className="chat-muted">
          Preparing your file… PDF extraction can take up to 45 seconds. Video
          files up to 500 MB may take longer to copy.
        </p>
      )}
      <div className="source-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search documents and media"
            placeholder="Search titles, notes, or extracted text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter source type"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="all">All source types</option>
          {Object.entries(names).map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
        <span>{filtered.length} sources</span>
      </div>
      <div className="sources-layout">
        <section className="source-list" aria-label="Saved sources">
          {loading ? (
            <p className="chat-muted">Opening sources…</p>
          ) : !filtered.length ? (
            <div className="empty">
              <BookOpen size={30} />
              <h2>
                {sources.length
                  ? 'No matching sources'
                  : 'Your next lesson starts here.'}
              </h2>
              <p>
                Import a PDF, video file, or transcript, or save a video,
                interview, or website link.
              </p>
            </div>
          ) : (
            filtered.map((s) => (
              <button
                disabled={busy}
                className={`source-row ${s.id === selected ? 'chosen' : ''}`}
                key={s.id}
                onClick={() => setSelected(s.id)}
              >
                <span className="pill">{names[s.kind]}</span>
                <h3>{s.title}</h3>
                <p>{s.author || 'Author not recorded'}</p>
                <small>{status(s)}</small>
                {q &&
                  s.pages?.some((p) => p.text.toLowerCase().includes(q)) && (
                    <small className="source-hit">
                      Matching PDF pages:{' '}
                      {s.pages
                        .filter((p) => p.text.toLowerCase().includes(q))
                        .slice(0, 8)
                        .map((p) => p.number)
                        .join(', ')}
                    </small>
                  )}
              </button>
            ))
          )}
        </section>
        <section className="source-reader" aria-label="Source reader">
          {current ? (
            <>
              <div className="panel-heading">
                <h2>{names[current.kind]}</h2>
                <span>{status(current)}</span>
              </div>
              <div className="source-reader-content">
                <h2>{current.title}</h2>
                <dl className="source-details">
                  <dt>Author / speaker</dt>
                  <dd>{current.author || 'Not recorded'}</dd>
                  <dt>Source date</dt>
                  <dd>{current.sourceDate || 'Not recorded'}</dd>
                  <dt>Page / timestamp</dt>
                  <dd>{current.locator || 'Not recorded'}</dd>
                  <dt>Source link</dt>
                  <dd>{current.url || 'Not recorded'}</dd>
                  <dt>Rights / permission</dt>
                  <dd>{current.permission}</dd>
                  {current.file && (
                    <>
                      <dt>Original file</dt>
                      <dd>
                        {current.file.originalName} ·{' '}
                        {(current.file.size / 1024 / 1024).toFixed(2)} MB
                      </dd>
                    </>
                  )}
                </dl>
                {current.kind === 'pdf' && (
                  <>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await unwrap(api!.previewPdf(current.id, page));
                        })
                      }
                    >
                      <BookOpen size={15} />
                      View full PDF · charts & layout
                    </button>
                    <p className="chat-muted">
                      The text below is a searchable extraction. Open the full
                      PDF to see charts, diagrams, images, and the original
                      layout. Visual content has not been interpreted by AI.
                    </p>
                  </>
                )}
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await unwrap(api!.openSource(current.id));
                    })
                  }
                >
                  <ExternalLink size={14} />
                  {current.file ? 'Open original file' : 'Open link in browser'}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    const {
                      title,
                      author,
                      url,
                      permission,
                      notes,
                      sourceDate,
                      locator,
                    } = current;
                    setMetadata({
                      title,
                      author,
                      url,
                      permission,
                      notes,
                      sourceDate: sourceDate ?? '',
                      locator: locator ?? '',
                    });
                    setDraft({ kind: current.kind, edit: current });
                    setError('');
                  }}
                >
                  Edit source details
                </button>
                {current.notes && (
                  <div className="source-own-notes">
                    <strong>Your notes / context</strong>
                    <p>{current.notes}</p>
                  </div>
                )}
                {current.kind === 'pdf' && (
                  <>
                    <div className="pdf-pagination">
                      <button
                        className="button secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous page
                      </button>
                      <label>
                        PDF page{' '}
                        <input
                          aria-label="PDF page number"
                          type="number"
                          min={1}
                          max={current.pages!.length}
                          value={page}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (
                              Number.isInteger(n) &&
                              n >= 1 &&
                              n <= current.pages!.length
                            )
                              setPage(n);
                          }}
                        />{' '}
                        / {current.pages!.length}
                      </label>
                      <button
                        className="button secondary"
                        disabled={page >= current.pages!.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next page
                      </button>
                    </div>
                    <p className="chat-muted">
                      References use PDF file page numbers. Extracted tables,
                      equations, and reading order may need checking against the
                      original.
                    </p>
                    {matches.length > 0 && (
                      <div className="page-matches" aria-label="Matching pages">
                        {matches.slice(0, 30).map((p) => (
                          <button
                            key={p.number}
                            onClick={() => setPage(p.number)}
                            className={
                              page === p.number ? 'pill active' : 'pill'
                            }
                          >
                            Page {p.number}
                          </button>
                        ))}
                        {matches.length > 30 && (
                          <span>
                            Showing first 30 of {matches.length} matching pages.
                          </span>
                        )}
                      </div>
                    )}
                    <div className="citation">
                      <strong>Source reference</strong>
                      <p>
                        {[
                          current.author,
                          current.title,
                          `PDF page ${page}`,
                          current.url,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="extracted-text">
                      {current.pages!.find((p) => p.number === page)?.text ||
                        'No extractable text on this page. Open the original to inspect images or scanned content.'}
                    </div>
                  </>
                )}
                {current.kind === 'transcript' && (
                  <>
                    <h3>Imported transcript</h3>
                    <p className="chat-muted">
                      Plain text; original timestamps are preserved when
                      present.
                    </p>
                    <div className="extracted-text">{current.content}</div>
                  </>
                )}
                {(current.kind === 'video-file' ||
                  current.kind.endsWith('-link')) && (
                  <div className="quiet-callout">
                    {current.kind === 'video-file'
                      ? 'Video stored locally. The app has not watched or transcribed it.'
                      : 'Only the link and your notes are saved. The app has not retrieved or analysed the linked content.'}{' '}
                    Import a permitted transcript as a separate source and use
                    the same source link or title to make it easy to find.
                  </div>
                )}
                <button
                  className="delete-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await unwrap(api!.deleteSource(current.id));
                      await load();
                      onChanged();
                      setSelected(undefined);
                    })
                  }
                >
                  <Trash2 size={14} />
                  Delete source record
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <FileText size={30} />
              <h2>Select a source to read it.</h2>
              <p>
                Search can find PDF passages and show their exact file page
                numbers.
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="chat-muted">
        Files stay in this device’s library folder. Export a ZIP backup to
        include originals; JSON backups contain records and extracted text only.
        Deleted source originals are retained for backup compatibility.
      </p>
      <dialog
        ref={dialog}
        className="modal source-dialog"
        onCancel={(e) => {
          e.preventDefault();
          void close();
        }}
      >
        <div className="modal-heading">
          <div>
            <div className="eyebrow">DOCUMENTS & MEDIA</div>
            <h2>Add {draft ? names[draft.kind].toLowerCase() : 'source'}</h2>
          </div>
          <button
            type="button"
            aria-label="Close source editor"
            disabled={busy}
            onClick={() => void close()}
          >
            <X />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const saved = draft!.edit
                ? await unwrap(api!.editSource(draft!.edit.id, metadata))
                : draft!.file
                  ? await unwrap(
                      api!.saveSourceFile(draft!.file.token, metadata),
                    )
                  : await unwrap(
                      api!.saveSourceLink(
                        draft!.kind as
                          'video-link' | 'interview-link' | 'web-link',
                        metadata,
                      ),
                    );
              await load();
              setSelected(saved.id);
              setDraft(null);
              setMetadata({ ...empty });
              setNotice(
                'Source saved locally. No AI training or external upload was performed.',
              );
              onChanged();
            });
          }}
        >
          <div className="form-fields">
            {draft?.edit ? (
              <div className="import-preview">
                <strong>Editing {names[draft.kind].toLowerCase()}</strong>
                <p>
                  Original content is preserved; only source details and your
                  notes will change.
                </p>
              </div>
            ) : draft?.file ? (
              <div className="import-preview">
                <strong>{draft.file.fileName}</strong>
                <p>
                  {draft.kind === 'pdf'
                    ? `${draft.file.pageCount} PDF pages; text extracted where available.`
                    : draft.kind === 'video-file'
                      ? 'Local copy will be saved. Transcription is not implemented.'
                      : 'Transcript text will be saved.'}
                </p>
                {draft.file.textPreview && <pre>{draft.file.textPreview}</pre>}
              </div>
            ) : (
              <label className="field">
                <span>Link type</span>
                <select
                  value={draft?.kind ?? 'video-link'}
                  onChange={(e) =>
                    setDraft({ kind: e.target.value as SourceKind })
                  }
                >
                  <option value="video-link">Video link</option>
                  <option value="interview-link">Interview link</option>
                  <option value="web-link">Website / article link</option>
                </select>
              </label>
            )}
            <label className="field">
              <span>Source title *</span>
              <input
                required
                maxLength={2000}
                value={metadata.title}
                onChange={(e) =>
                  setMetadata({ ...metadata, title: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Author / speaker</span>
              <input
                maxLength={2000}
                value={metadata.author}
                onChange={(e) =>
                  setMetadata({ ...metadata, author: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>
                {draft?.file || draft?.edit?.file
                  ? 'Source URL (optional)'
                  : 'Source URL *'}
              </span>
              <input
                type="url"
                required={!draft?.file && !draft?.edit?.file}
                maxLength={2000}
                placeholder="https://…"
                value={metadata.url}
                onChange={(e) =>
                  setMetadata({ ...metadata, url: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Source date</span>
                <input
                  type="date"
                  value={metadata.sourceDate ?? ''}
                  onChange={(e) =>
                    setMetadata({ ...metadata, sourceDate: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Page / video timestamp</span>
                <input
                  maxLength={2000}
                  value={metadata.locator ?? ''}
                  onChange={(e) =>
                    setMetadata({ ...metadata, locator: e.target.value })
                  }
                  placeholder="e.g. 00:12:30"
                />
              </label>
            </div>
            <label className="field">
              <span>Rights / permission *</span>
              <input
                required
                maxLength={2000}
                placeholder="Describe your permission to store and use this material"
                value={metadata.permission}
                onChange={(e) =>
                  setMetadata({ ...metadata, permission: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Your notes / context</span>
              <textarea
                rows={3}
                maxLength={50000}
                placeholder="Keep your own interpretation separate from the original content."
                value={metadata.notes}
                onChange={(e) =>
                  setMetadata({ ...metadata, notes: e.target.value })
                }
              />
            </label>
            <p className="form-hint">
              Only store material you are allowed to use. Possessing a book or
              video does not automatically permit every use.
            </p>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => void close()}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save source'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
