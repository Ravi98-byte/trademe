import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  Layers3,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  categories,
  evidenceKinds,
  type DesktopAPI,
  type Entry,
  type EntryInput,
  type Result,
} from './shared';
import './styles.css';
declare global {
  interface Window {
    trademe?: DesktopAPI;
  }
}
const blank: EntryInput = {
  title: '',
  content: '',
  author: '',
  source: '',
  sourceDate: '',
  locator: '',
  permission: '',
  category: 'Research notes',
  evidence: 'Personal note',
};
const modules = [
  {
    name: 'Market intelligence',
    icon: Activity,
    stage: 'Planned · Milestone 4',
    description:
      'Licensed NQ / MNQ prices, economic events, and news with clear timestamps and data freshness.',
  },
  {
    name: 'Strategy lab',
    icon: FlaskConical,
    stage: 'Planned · Milestone 3',
    description:
      'Explicit trading rules, historical testing, commissions, slippage, and out-of-sample results.',
  },
  {
    name: 'Risk & accounts',
    icon: ShieldCheck,
    stage: 'Planned · Milestone 4–5',
    description:
      'Verified read-only account information and account-specific drawdown rules before paper trading.',
  },
];
function App() {
  const [page, setPage] = useState('Knowledge library');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All notes');
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<EntryInput | null>(null);
  const [editing, setEditing] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storage, setStorage] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const modalOpen = form !== null;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setForm(null);
        setError('');
      }
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea',
        ) ?? [],
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [modalOpen, busy]);
  const api = window.trademe;
  async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
    const result = await promise;
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }
  async function refresh() {
    if (!api) return;
    setEntries(await unwrap(api.list()));
  }
  useEffect(() => {
    if (!api) {
      setLoading(false);
      return;
    }
    Promise.all([refresh(), unwrap(api.storageInfo()).then(setStorage)])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  function newNote() {
    setEditing(undefined);
    setForm({ ...blank });
    setError('');
  }
  const filtered = entries.filter(
    (e) =>
      (category === 'All notes' || e.category === category) &&
      `${e.title} ${e.content} ${e.author} ${e.source} ${e.locator} ${e.evidence}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const active = entries.find((e) => e.id === selected);
  async function backup() {
    if (api)
      await run(async () => {
        const path = await unwrap(api.backup());
        if (path)
          setNotice('Backup exported. Keep a copy on a separate drive.');
      });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={modalOpen}>
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} />
          </div>
          <span>
            TradeMe<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={page === 'Overview' ? 'nav active' : 'nav'}
            onClick={() => setPage('Overview')}
          >
            <Layers3 size={18} />
            Overview
          </button>
          <button
            className={page === 'Knowledge library' ? 'nav active' : 'nav'}
            onClick={() => setPage('Knowledge library')}
          >
            <BookOpen size={18} />
            Knowledge library<span className="nav-count">{entries.length}</span>
          </button>
          <div className="nav-separator" />
          {modules.map((m) => (
            <button
              key={m.name}
              className={page === m.name ? 'nav active' : 'nav'}
              onClick={() => setPage(m.name)}
            >
              <m.icon size={18} />
              {m.name}
              <span className="soon-dot" />
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-card">
            <ShieldCheck size={18} />
            <strong>Research mode</strong>
            <p>
              Build knowledge.
              <br />
              Keep execution offline.
            </p>
            <span>
              <span className="green-dot" /> No account connected
            </span>
          </div>
          <button
            className={page === 'Settings' ? 'nav active' : 'nav'}
            onClick={() => setPage('Settings')}
          >
            <Settings2 size={18} />
            Settings & storage
          </button>
          <div className="profile">
            <div className="avatar">R</div>
            <div>
              Ravi’s workspace<small>Local · Private by default</small>
            </div>
            <span className="version">v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={modalOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <span>{page}</span>
          </div>
          <div className="top-status">
            <span className="local-tag">
              <span className="green-dot" /> LOCAL FIRST
            </span>
            <span className="divider" />
            <LockKeyhole size={14} /> Execution disabled
          </div>
        </header>
        <main>
          {!api && (
            <div className="alert">
              Browser preview only. Open the Electron desktop app to save notes,
              import files, or export backups.
            </div>
          )}
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert success">
              <Check size={16} />
              {notice}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR RESEARCH, CONNECTED</div>
              <h1>{page}</h1>
              <p>
                {page === 'Knowledge library'
                  ? 'A considered place for your trading knowledge. Every idea has a source.'
                  : page === 'Overview'
                    ? 'A clear foundation for better research decisions.'
                    : 'Your workspace, built one deliberate step at a time.'}
              </p>
            </div>
            {page === 'Knowledge library' && (
              <div className="heading-actions">
                <button
                  disabled={!api || busy || loading}
                  className="button secondary"
                  onClick={() =>
                    run(async () => {
                      const imported = await unwrap(api!.importText());
                      if (imported) {
                        setEditing(undefined);
                        setForm({ ...blank, ...imported });
                      }
                    })
                  }
                >
                  <ArrowDownToLine size={16} />
                  Import text
                </button>
                <button
                  disabled={!api || busy || loading}
                  className="button primary"
                  onClick={newNote}
                >
                  <Plus size={17} />
                  New note
                </button>
              </div>
            )}
          </div>
          {(page === 'Knowledge library' || page === 'Overview') && (
            <div className="stats">
              <Stat
                label="LIBRARY NOTES"
                value={String(entries.length).padStart(2, '0')}
                detail="Ideas with context"
                icon={<BookOpen size={19} />}
              />
              <Stat
                label="SOURCE REFERENCES"
                value={String(entries.filter((e) => e.source).length).padStart(
                  2,
                  '0',
                )}
                detail="Traceable to their origin"
                icon={<FileText size={19} />}
              />
              <Stat
                label="TEST RESULTS"
                value={String(
                  entries.filter((e) => e.evidence === 'Test result').length,
                ).padStart(2, '0')}
                detail="User-recorded · not verified"
                icon={<FlaskConical size={19} />}
              />
              <Stat
                label="WORKSPACE STATUS"
                value="Research only"
                detail="No market or account connection"
                icon={<ShieldCheck size={19} />}
                safe
              />
            </div>
          )}
          {page === 'Knowledge library' && (
            <>
              <div className="library-toolbar">
                <div className="tabs">
                  <button className="tab selected">
                    All knowledge <span>{entries.length}</span>
                  </button>
                </div>
                <div className="tools">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search library"
                      placeholder="Search notes, sources, ideas…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>All notes</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="library-layout">
                <section className="notes-panel" aria-label="Library notes">
                  <div className="panel-heading">
                    <h2>
                      {query || category !== 'All notes'
                        ? 'Search results'
                        : 'Your knowledge'}
                    </h2>
                    <span>
                      {filtered.length}{' '}
                      {filtered.length === 1 ? 'note' : 'notes'}
                    </span>
                  </div>
                  {loading ? (
                    <div className="empty">
                      <Database />
                      <h3>Opening your library…</h3>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">
                        <BookOpen size={30} />
                      </div>
                      <span className="eyebrow">
                        MAKE ROOM FOR YOUR NEXT IDEA
                      </span>
                      <h2>
                        {entries.length
                          ? 'No matching notes'
                          : 'Good research starts with a note.'}
                      </h2>
                      <p>
                        {entries.length
                          ? 'Try a different search or category.'
                          : 'Capture a lesson, a strategy hypothesis, or a passage you have permission to use. Keep its source close.'}
                      </p>
                      {!entries.length && (
                        <button
                          disabled={!api || busy}
                          className="button primary"
                          onClick={newNote}
                        >
                          <Plus size={16} />
                          Create your first note
                        </button>
                      )}
                      <div className="format-label">
                        PLAIN TEXT & MARKDOWN IMPORTS SUPPORTED
                      </div>
                    </div>
                  ) : (
                    <div className="note-list">
                      {filtered.map((e) => (
                        <button
                          className={`note-row ${selected === e.id ? 'chosen' : ''}`}
                          key={e.id}
                          onClick={() => setSelected(e.id)}
                        >
                          <div className="note-symbol">
                            <FileText size={19} />
                          </div>
                          <div className="note-summary">
                            <div className="note-meta">
                              <span>{e.category}</span>
                              <span>·</span>
                              <span>{e.evidence}</span>
                            </div>
                            <h3>{e.title}</h3>
                            <p>{e.content.slice(0, 140)}</p>
                            <div className="note-origin">
                              {e.author || 'Author not recorded'}
                              <span> · </span>
                              {new Date(e.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
                <aside className="context-panel">
                  {active ? (
                    <>
                      <div className="panel-heading">
                        <h2>Source & context</h2>
                        <FileText size={16} />
                      </div>
                      <div className="detail">
                        <span className="pill">{active.evidence}</span>
                        <h2>{active.title}</h2>
                        <p className="note-content">{active.content}</p>
                        <dl>
                          {[
                            ['Author', active.author],
                            ['Source / link', active.source],
                            ['Source date', active.sourceDate],
                            ['Page / timestamp', active.locator],
                            ['Rights / permission', active.permission],
                          ].map(([key, val]) => (
                            <React.Fragment key={key}>
                              <dt>{key}</dt>
                              <dd>{val || 'Not recorded'}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                        <div className="citation">
                          <strong>Source reference</strong>
                          <p>
                            {[
                              active.author,
                              active.title,
                              active.source,
                              active.sourceDate,
                              active.locator,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <button
                          className="button secondary full"
                          disabled={busy}
                          onClick={() => {
                            const { id, createdAt, updatedAt, ...input } =
                              active;
                            setEditing(id);
                            setForm(input);
                          }}
                        >
                          Edit note
                        </button>
                        <button
                          className="delete-button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await unwrap(api!.remove(active.id));
                              setSelected(null);
                              await refresh();
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete note
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="panel-heading">
                        <h2>A library with perspective</h2>
                        <BookOpen size={16} />
                      </div>
                      <div className="context-content">
                        <div className="context-illustration">
                          <Layers3 size={42} />
                          <span className="spark">✦</span>
                        </div>
                        <h3>Keep the evidence close.</h3>
                        <p>
                          A useful idea is more than a quote. Record where it
                          came from, what it means, and what still needs
                          testing.
                        </p>
                        <div className="principle">
                          <span>01</span>
                          <div>
                            <strong>Trace the source</strong>
                            <p>Author, link, page, or timestamp.</p>
                          </div>
                        </div>
                        <div className="principle">
                          <span>02</span>
                          <div>
                            <strong>Label the claim</strong>
                            <p>Opinion, observation, or test result.</p>
                          </div>
                        </div>
                        <div className="principle">
                          <span>03</span>
                          <div>
                            <strong>Respect the rights</strong>
                            <p>Keep only material you may use.</p>
                          </div>
                        </div>
                        <div className="quiet-callout">
                          Notes are research material. They are not trade
                          signals or verified results.
                        </div>
                      </div>
                    </>
                  )}
                </aside>
              </div>
              <footer className="library-footer">
                <span>
                  <Database size={13} />
                  Saved on this device · Automatic backups on changes
                </span>
                <button disabled={!api || busy || loading} onClick={backup}>
                  Export a backup <ArrowUpRight size={13} />
                </button>
              </footer>
            </>
          )}
          {page === 'Overview' && (
            <section className="roadmap">
              <h2>Your research workspace is taking shape.</h2>
              <p>
                The knowledge library is the first working module. Future
                capabilities remain disconnected until they are implemented and
                tested.
              </p>
              <button
                className="button primary"
                onClick={() => setPage('Knowledge library')}
              >
                Open knowledge library <ChevronRight size={16} />
              </button>
              <div className="roadmap-grid">
                {modules.map((m) => (
                  <div key={m.name}>
                    <m.icon />
                    <span className="pill">{m.stage}</span>
                    <h3>{m.name}</h3>
                    <p>{m.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {modules.some((m) => m.name === page) && (
            <section className="planned">
              <div className="empty-icon">
                {React.createElement(
                  modules.find((m) => m.name === page)!.icon,
                  { size: 32 },
                )}
              </div>
              <span className="pill">
                {modules.find((m) => m.name === page)!.stage}
              </span>
              <h2>Built on evidence. Added in stages.</h2>
              <p>{modules.find((m) => m.name === page)!.description}</p>
              <div className="quiet-callout">
                This module is not implemented. No prices, performance figures,
                account balances, or trading signals are being generated.
              </div>
              <button
                className="button secondary"
                onClick={() => setPage('Knowledge library')}
              >
                Return to your library
              </button>
            </section>
          )}
          {page === 'Settings' && (
            <section className="settings-panel">
              <h2>
                <FolderOpen size={20} /> Local storage & recovery
              </h2>
              <p>
                Your notes stay on this computer. There are no AI, market data,
                or account services connected.
              </p>
              <label>Library directory</label>
              <code>{storage || 'Available in the desktop application'}</code>
              <h3>Back up your work</h3>
              <p>
                The last 20 previous library versions are kept in the backups
                folder. Export a backup regularly to a separate drive. Files are
                not encrypted by the app; use your operating system’s disk
                encryption and a protected user account.
              </p>
              <button
                className="button primary"
                disabled={!api || busy || loading}
                onClick={backup}
              >
                <ArrowDownToLine size={16} />
                Export library backup
              </button>
              <h3>Restore carefully</h3>
              <p>
                Close TradeMe, keep a copy of the current library.json, then
                replace it with a verified exported backup. Reopen the app and
                check your notes. This first version does not include an in-app
                restore wizard.
              </p>
              <h3>Trading & external services</h3>
              <p>
                Execution is disabled by design. No credentials are stored or
                requested. Provider choices, fees, and account permissions will
                be reviewed before future integrations.
              </p>
            </section>
          )}
        </main>
        <div className="bottom-bar">
          <span>
            <span className="green-dot" />
            Local workspace
          </span>
          <span>
            NQ / MNQ research
            <span className="divider" /> No live market data
          </span>
          <span>
            FOUNDATION RELEASE <span className="version">0.1.0</span>
          </span>
        </div>
      </div>
      {form && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">KNOWLEDGE LIBRARY</div>
                <h2 id="note-title">
                  {editing ? 'Edit research note' : 'New research note'}
                </h2>
              </div>
              <button
                aria-label="Close note editor"
                disabled={busy}
                onClick={() => {
                  setForm(null);
                  setError('');
                }}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const saved = await unwrap(api!.save(form, editing));
                  await refresh();
                  setSelected(saved.id);
                  setForm(null);
                  setNotice('Note saved to your local library.');
                });
              }}
            >
              <div className="form-fields">
                <Field label="Title *">
                  <input
                    autoFocus
                    required
                    maxLength={2000}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="What is this idea about?"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Category">
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value as EntryInput['category'],
                        })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Evidence type">
                    <select
                      value={form.evidence}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          evidence: e.target.value as EntryInput['evidence'],
                        })
                      }
                    >
                      {evidenceKinds.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Note content *">
                  <textarea
                    required
                    maxLength={500000}
                    rows={6}
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="Record the idea, its context, and its limitations. Markdown is stored as plain text."
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Author">
                    <input
                      maxLength={2000}
                      value={form.author}
                      onChange={(e) =>
                        setForm({ ...form, author: e.target.value })
                      }
                      placeholder="Your name or original author"
                    />
                  </Field>
                  <Field label="Source date">
                    <input
                      type="date"
                      value={form.sourceDate}
                      onChange={(e) =>
                        setForm({ ...form, sourceDate: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Source title or URL">
                  <input
                    maxLength={2000}
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value })
                    }
                    placeholder="Book, article, interview, or original observation"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Page or timestamp">
                    <input
                      maxLength={2000}
                      value={form.locator}
                      onChange={(e) =>
                        setForm({ ...form, locator: e.target.value })
                      }
                      placeholder="e.g. page 42 or 00:18:20"
                    />
                  </Field>
                  <Field label="Rights / permission *">
                    <input
                      required
                      maxLength={2000}
                      value={form.permission}
                      onChange={(e) =>
                        setForm({ ...form, permission: e.target.value })
                      }
                      placeholder="e.g. My original writing"
                    />
                  </Field>
                </div>
                <p className="form-hint">
                  A “test result” label records your description; TradeMe has
                  not verified the test.
                </p>
                {error && (
                  <div className="alert error" role="alert">
                    {error}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setForm(null);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  safe = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  safe?: boolean;
}) {
  return (
    <div className={`stat ${safe ? 'safe' : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">
        {safe && <span className="green-dot" />}
        {detail}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
