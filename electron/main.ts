import { app, BrowserWindow, dialog, ipcMain, clipboard } from 'electron';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibraryStore } from './store.js';
import type { Result } from '../src/shared.js';
import updater from 'electron-updater';
import { existsSync } from 'node:fs';
import { UpdateController } from './updates.js';
const here = dirname(fileURLToPath(import.meta.url));
let window: BrowserWindow;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
  app.whenReady().then(() => {
    const store = new LibraryStore(join(app.getPath('userData'), 'knowledge'));
    const installedWindows =
      process.platform === 'win32' &&
      app.isPackaged &&
      existsSync(join(dirname(process.execPath), 'Uninstall TradeMe.exe'));
    const { autoUpdater } = updater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = null;
    const updates = new UpdateController(
      installedWindows ? autoUpdater : null,
      app.getVersion(),
      async () => {
        const directory = join(app.getPath('userData'), 'pre-update-backups');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await store.export(join(directory, `library-${Date.now()}.json`));
      },
    );
    function handle<T>(name: string, action: (...args: any[]) => Promise<T>) {
      ipcMain.handle(name, async (event, ...args): Promise<Result<T>> => {
        if (
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame
        )
          return { ok: false, error: 'Untrusted request.' };
        try {
          return { ok: true, value: await action(...args) };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : 'Operation failed.',
          };
        }
      });
    }
    handle('updates:status', async () => updates.status());
    handle('updates:check', () => updates.check());
    handle('updates:download', () => updates.download());
    handle('updates:install', async () => {
      if (updates.status().phase !== 'ready') return updates.status();
      const confirmation = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Cancel', 'Back up and restart'],
        defaultId: 0,
        cancelId: 0,
        message: 'Install the downloaded update?',
        detail:
          'Save any unsent notes and chat drafts first. TradeMe will back up your saved library, close, run the installer, and reopen. No trading connection exists in this release.',
      });
      if (confirmation.response !== 1) return updates.status();
      return updates.install();
    });
    handle('questions:list', () => store.listQuestions());
    handle('questions:create', (input) => store.createQuestion(input));
    handle('questions:reply', (id, content, source) =>
      store.replyToQuestion(id, content, source),
    );
    handle('questions:copy', async (id) => {
      const q = (await store.listQuestions()).find((q) => q.id === id);
      if (!q) throw new Error('Question not found.');
      clipboard.writeText(
        `Research question: ${q.question}\n\nWhy this information is needed: ${q.reason}\n\nPlease include sources, dates, and uncertainties. This is a research question, not permission to trade.`,
      );
    });
    handle('questions:delete', async (id) => {
      const result = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Cancel', 'Delete question'],
        defaultId: 0,
        cancelId: 0,
        message: 'Delete this question and its replies?',
        detail:
          'Previous versions may remain in automatic backups and exported files.',
      });
      if (result.response !== 1) throw new Error('Deletion cancelled.');
      await store.deleteQuestion(id);
    });
    handle('library:list', () => store.list());
    handle('library:save', (input, id) => {
      if (id !== undefined && typeof id !== 'string')
        throw new Error('Invalid entry ID.');
      return store.save(input, id);
    });
    handle('library:remove', async (id) => {
      if (typeof id !== 'string') throw new Error('Invalid entry ID.');
      const confirmation = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Cancel', 'Delete note'],
        defaultId: 0,
        cancelId: 0,
        message: 'Delete this library note?',
        detail: 'An automatic local backup retains the previous library.',
      });
      if (confirmation.response !== 1) throw new Error('Deletion cancelled.');
      return store.remove(id);
    });
    handle('library:storage', async () => store.directory);
    handle('library:import', async () => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
          { name: 'Plain text and Markdown', extensions: ['txt', 'md'] },
        ],
      });
      if (result.canceled) return null;
      const path = result.filePaths[0];
      if (!['.txt', '.md'].includes(extname(path).toLowerCase()))
        throw new Error('Choose a .txt or .md file.');
      if ((await stat(path)).size > 500_000)
        throw new Error('Choose a text file under 500 KB.');
      const content = await readFile(path, 'utf8');
      if (content.includes('\0'))
        throw new Error('This file is not plain text.');
      return { title: basename(path, extname(path)), content };
    });
    handle('library:backup', async () => {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: `trademe-library-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'Library backup', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return null;
      await store.export(result.filePath);
      return result.filePath;
    });
    const createWindow = () => {
      window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0b0e14',
        title: 'TradeMe',
        webPreferences: {
          preload: join(here, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event) => event.preventDefault());
      window.setMenuBarVisibility(false);
      const dev = !app.isPackaged && process.env.TRADEME_DEV_URL;
      if (dev === 'http://127.0.0.1:5173') void window.loadURL(dev);
      else void window.loadFile(join(here, '../../dist/index.html'));
    };
    createWindow();
    if (installedWindows) {
      const timer = setTimeout(() => {
        void updates.check();
      }, 15000);
      timer.unref();
    }
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
