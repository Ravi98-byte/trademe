import { useEffect, useState } from 'react';
import { Copy, MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import type { DesktopAPI, ResearchQuestion, Result } from './shared';

async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export function ResearchChat({
  api,
  onChanged,
}: {
  api?: DesktopAPI;
  onChanged: () => void;
}) {
  const [threads, setThreads] = useState<ResearchQuestion[]>([]);
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState('');
  const [reply, setReply] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = threads.find((t) => t.id === selected);
  async function load() {
    if (!api) return;
    const items = await unwrap(api.listQuestions());
    setThreads(items);
    return items;
  }
  useEffect(() => {
    load()
      .then((items) => setSelected(items?.[0]?.id))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
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
  function select(id: string) {
    if (
      (reply.trim() ||
        source.trim() ||
        (creating && (question.trim() || reason.trim()))) &&
      !window.confirm('Discard the unsaved draft?')
    )
      return;
    setSelected(id);
    setCreating(false);
    setReply('');
    setSource('');
    setQuestion('');
    setReason('');
    setNotice('');
    setError('');
  }
  return (
    <section className="research-chat" aria-label="Research questions">
      <div className="chat-explainer">
        <MessageSquare size={21} />
        <div>
          <strong>A place for the agent to ask you for help</strong>
          <p>
            Copy a question into ChatGPT, research it, then paste your reply
            into its thread. This release has no AI connected; create a manual
            test question to try the workflow. Nothing is sent automatically.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="alert success">
          {notice}
        </div>
      )}
      <div className="chat-layout">
        <aside className="question-list">
          <div className="panel-heading">
            <h2>Question threads</h2>
            <span>{threads.length}</span>
          </div>
          <button
            className="button primary full"
            disabled={!api || busy || loading}
            onClick={() => {
              if (
                (reply.trim() || source.trim()) &&
                !window.confirm('Discard the unsaved reply?')
              )
                return;
              setCreating(true);
              setReply('');
              setSource('');
              setError('');
              setNotice('');
            }}
          >
            <Plus size={15} />
            Create manual test question
          </button>
          {loading ? (
            <p className="chat-muted">Opening conversations…</p>
          ) : !threads.length ? (
            <p className="chat-muted">
              No questions yet. When an AI engine is added, its requests for
              missing information will appear here.
            </p>
          ) : (
            threads.map((t) => (
              <button
                disabled={busy}
                key={t.id}
                className={`question-item ${!creating && t.id === selected ? 'chosen' : ''}`}
                onClick={() => select(t.id)}
              >
                <span
                  className={`question-status ${t.replies.length ? 'answered' : ''}`}
                >
                  {t.replies.length ? 'Reply recorded' : 'Awaiting reply'}
                </span>
                <strong>{t.question}</strong>
                <small>
                  Manual test · {new Date(t.createdAt).toLocaleDateString()}
                </small>
              </button>
            ))
          )}
        </aside>
        <section className="conversation" aria-label="Selected question">
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const thread = await unwrap(
                    api!.createQuestion({ question, reason }),
                  );
                  await load();
                  onChanged();
                  setSelected(thread.id);
                  setCreating(false);
                  setQuestion('');
                  setReason('');
                  setNotice(
                    'Manual test question saved. No AI generated this question.',
                  );
                });
              }}
            >
              <div className="panel-heading">
                <h2>Manual test question</h2>
                <span className="pill">No AI connected</span>
              </div>
              <div className="chat-compose">
                <p className="chat-muted">
                  Use this to test the handoff before the agent exists. Don’t
                  paste passwords, account credentials, or private account
                  details.
                </p>
                <label className="field">
                  <span>Question *</span>
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={10000}
                    required
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Why is this information needed? *</span>
                  <textarea
                    rows={3}
                    maxLength={10000}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="button primary" disabled={busy || !api}>
                  Save test question
                </button>
              </div>
            </form>
          ) : active ? (
            <>
              <div className="panel-heading">
                <h2>Research conversation</h2>
                <span className="pill">
                  {active.replies.length ? 'Reply recorded' : 'Awaiting reply'}
                </span>
              </div>
              <div className="transcript">
                <article className="chat-message question">
                  <div className="message-label">
                    MANUAL TEST QUESTION ·{' '}
                    {new Date(active.createdAt).toLocaleString()}
                  </div>
                  <h2>{active.question}</h2>
                  <h3>Why this information is needed</h3>
                  <p>{active.reason}</p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await unwrap(api!.copyQuestion(active.id));
                        setNotice(
                          'Question copied. Review it before pasting into ChatGPT.',
                        );
                      })
                    }
                  >
                    <Copy size={14} />
                    Copy question for ChatGPT
                  </button>
                </article>
                {active.replies.map((r) => (
                  <article className="chat-message reply" key={r.id}>
                    <div className="message-label">
                      YOUR REPLY · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <p>{r.content}</p>
                    <div className="reply-source">
                      Source / reference: {r.source || 'Not supplied'}
                    </div>
                    <span className="unverified">
                      User-provided · Not independently verified
                    </span>
                  </article>
                ))}
                <div className="quiet-callout">
                  A reply adds information to this conversation. It does not
                  verify a claim, change account rules, approve a trade, or
                  resume an action. Automatic AI follow-up is not implemented.
                </div>
              </div>
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await unwrap(
                      api!.replyToQuestion(active.id, reply, source),
                    );
                    await load();
                    onChanged();
                    setReply('');
                    setSource('');
                    setNotice(
                      'Reply saved in this thread. No action was taken.',
                    );
                  });
                }}
              >
                <label className="field">
                  <span>Your reply *</span>
                  <textarea
                    required
                    maxLength={50000}
                    rows={4}
                    placeholder="Paste your researched answer here. Include uncertainties and relevant dates."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Source / reference (optional)</span>
                  <input
                    maxLength={2000}
                    placeholder="Original source URL, ChatGPT share link, or your explanation"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </label>
                <div className="chat-composer-actions">
                  <span>Drafts stay unsaved until you click Save reply.</span>
                  <button
                    className="button primary"
                    disabled={busy || !reply.trim()}
                  >
                    <Send size={14} />
                    Save reply
                  </button>
                </div>
              </form>
              <button
                className="delete-button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await unwrap(api!.deleteQuestion(active.id));
                    const remaining = await load();
                    setSelected(remaining?.[0]?.id);
                    setReply('');
                    setSource('');
                    onChanged();
                  })
                }
              >
                <Trash2 size={14} />
                Delete question and replies
              </button>
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <MessageSquare size={28} />
              </div>
              <h2>Keep questions and answers together.</h2>
              <p>
                Choose a thread or create a manual test question. The library
                and this chat stay on your device.
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="chat-muted">
        Questions and replies are included in the library’s exported backups.
        Copies may remain in previous automatic backups after deletion.
      </p>
    </section>
  );
}
