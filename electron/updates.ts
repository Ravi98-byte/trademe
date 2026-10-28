import type { UpdateState } from '../src/shared.js';

export interface UpdateTransport {
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(silent?: boolean, runAfter?: boolean): void;
}

// All version decisions and artifact checksum checks belong to electron-updater.
// This controller only owns the user-controlled lifecycle and backup requirement.
export class UpdateController {
  private state: UpdateState;
  private operation = false;
  constructor(
    private readonly transport: UpdateTransport | null,
    version: string,
    private readonly beforeInstall: () => Promise<void>,
    unsupportedReason = 'Updates are available in the installed Windows application.',
  ) {
    this.state = {
      phase: transport ? 'idle' : 'unsupported',
      currentVersion: version,
      message: transport
        ? 'Check for a published update when you are ready.'
        : unsupportedReason,
    };
    transport?.on('update-available', (info: { version: string }) => {
      if (this.state.phase === 'checking')
        this.set({
          phase: 'available',
          version: info.version,
          message: `Version ${info.version} is available. Download when ready.`,
        });
    });
    transport?.on('update-not-available', () => {
      if (this.state.phase === 'checking')
        this.set({
          phase: 'current',
          message: 'You have the latest published version.',
        });
    });
    transport?.on('download-progress', (info: { percent: number }) => {
      if (this.state.phase === 'downloading' && Number.isFinite(info.percent))
        this.state = {
          ...this.state,
          progress: Math.max(0, Math.min(100, info.percent)),
        };
    });
    transport?.on('update-downloaded', (info: { version: string }) => {
      if (this.state.phase === 'downloading')
        this.set({
          phase: 'ready',
          version: info.version,
          message:
            'Update downloaded and checked. Save your work before restarting.',
        });
    });
    transport?.on('error', () => this.fail());
  }
  private set(next: Omit<UpdateState, 'currentVersion'>) {
    this.state = { ...next, currentVersion: this.state.currentVersion };
  }
  private fail() {
    if (this.state.phase === 'unsupported') return;
    this.set({
      phase: 'error',
      message:
        'The update could not be completed. Check your connection and whether this repository has an accessible published release. Your current app is unchanged.',
    });
  }
  status(): UpdateState {
    return { ...this.state };
  }
  async check(): Promise<UpdateState> {
    if (
      !this.transport ||
      this.operation ||
      ['checking', 'downloading', 'ready', 'installing'].includes(
        this.state.phase,
      )
    )
      return this.status();
    this.operation = true;
    this.set({ phase: 'checking', message: 'Checking published releases…' });
    try {
      await this.transport.checkForUpdates();
    } catch {
      this.fail();
    } finally {
      this.operation = false;
    }
    return this.status();
  }
  async download(): Promise<UpdateState> {
    if (!this.transport || this.operation || this.state.phase !== 'available')
      return this.status();
    this.operation = true;
    this.set({
      phase: 'downloading',
      version: this.state.version,
      progress: 0,
      message: 'Downloading the update. You can keep using the app.',
    });
    try {
      await this.transport.downloadUpdate();
    } catch {
      this.fail();
    } finally {
      this.operation = false;
    }
    return this.status();
  }
  async install(): Promise<UpdateState> {
    if (!this.transport || this.operation || this.state.phase !== 'ready')
      return this.status();
    this.operation = true;
    const ready = this.status();
    this.set({
      phase: 'installing',
      version: ready.version,
      message: 'Backing up your library before restarting…',
    });
    try {
      await this.beforeInstall();
      this.transport.quitAndInstall(false, true);
    } catch {
      this.state = {
        ...ready,
        message:
          'Restart was cancelled because the backup or installer could not be started. Your current app and data have been kept. Try again after checking storage access.',
      };
    } finally {
      this.operation = false;
    }
    return this.status();
  }
}
