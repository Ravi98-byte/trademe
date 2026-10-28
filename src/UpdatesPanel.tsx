import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { DesktopAPI, UpdateState, Result } from './shared';
export function UpdatesPanel({ api }: { api?: DesktopAPI }) {
  const [state, setState] = useState<UpdateState>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function accept(result: Promise<Result<UpdateState>>) {
    const value = await result;
    if (!value.ok) throw new Error(value.error);
    setState(value.value);
  }
  useEffect(() => {
    if (!api) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const result = await api.updateStatus();
        if (disposed) return;
        if (result.ok) setState(result.value);
        else setError(result.error);
      } catch {
        if (!disposed) setError('Could not read update status.');
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [api]);
  async function run(action: () => Promise<Result<UpdateState>>) {
    setPending(true);
    setError('');
    try {
      await accept(action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update request failed.');
    } finally {
      setPending(false);
    }
  }
  const phase = state?.phase;
  const busy =
    pending ||
    phase === 'checking' ||
    phase === 'downloading' ||
    phase === 'installing';
  return (
    <section className="updates-panel" aria-label="Application updates">
      <h2>
        <RefreshCw size={20} />
        App updates
      </h2>
      <p>
        Installed version:{' '}
        <strong>
          {state?.currentVersion ?? 'Available in the desktop app'}
        </strong>
      </p>
      <p role="status">
        {state?.message ?? 'Open the desktop app to check for updates.'}
      </p>
      {state?.progress !== undefined && (
        <div className="update-progress">
          <progress
            aria-label="Update download progress"
            max={100}
            value={state.progress}
          />
          <span>{Math.floor(state.progress)}%</span>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="heading-actions">
        <button
          className="button secondary"
          disabled={
            !api ||
            !state ||
            busy ||
            phase === 'unsupported' ||
            phase === 'ready'
          }
          onClick={() => run(() => api!.checkForUpdates())}
        >
          <RefreshCw size={15} />
          {phase === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
        {phase === 'available' && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => run(() => api!.downloadUpdate())}
          >
            <Download size={15} />
            Download {state?.version}
          </button>
        )}
        {phase === 'ready' && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => run(() => api!.installUpdate())}
          >
            Restart to install {state?.version}
          </button>
        )}
      </div>
      <p className="form-hint">
        Installed Windows builds check GitHub Releases shortly after opening.
        Downloads and restarts require your click. Your saved library is backed
        up before installation. Unsent drafts are not saved automatically.
      </p>
      <p className="form-hint">
        Only published stable releases are offered. Private release files
        require a separate authorised delivery service; no GitHub credentials
        are embedded in this app. Code signing is not configured yet.
      </p>
    </section>
  );
}
