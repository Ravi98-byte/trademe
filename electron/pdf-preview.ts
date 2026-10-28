import { BrowserWindow, session } from 'electron';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { LibraryStore } from './store.js';

const openPreviews = new Set<BrowserWindow>();

// The renderer supplies only a saved source ID and physical page number, never a path.
export async function previewPdf(
  store: LibraryStore,
  parent: BrowserWindow,
  id: unknown,
  requestedPage: unknown,
): Promise<void> {
  const source = (await store.listSources()).find((s) => s.id === id);
  if (!source || source.kind !== 'pdf')
    throw new Error('Choose an imported PDF document.');
  if (
    !Number.isInteger(requestedPage) ||
    (requestedPage as number) < 1 ||
    (requestedPage as number) > source.pages!.length
  )
    throw new Error('Choose a valid PDF page.');
  const file = await store.sourceFile(source.id); // checks original-file integrity
  const isolated = session.fromPartition(`pdf-preview-${randomUUID()}`);
  isolated.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  isolated.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  );
  const viewer = new BrowserWindow({
    parent,
    width: 1100,
    height: 850,
    minWidth: 600,
    minHeight: 450,
    title: `${source.title} — Original PDF`,
    backgroundColor: '#303030',
    webPreferences: {
      session: isolated,
      plugins: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  openPreviews.add(viewer);
  viewer.once('closed', () => openPreviews.delete(viewer));
  viewer.on('page-title-updated', (event) => {
    event.preventDefault();
    viewer.setTitle(`${source.title} — Original PDF`);
  });
  viewer.setMenuBarVisibility(false);
  viewer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  viewer.webContents.on('will-navigate', (event) => event.preventDefault());
  const url = pathToFileURL(file);
  url.hash = `page=${requestedPage}`;
  try {
    await viewer.loadURL(url.href);
  } catch {
    viewer.destroy();
    throw new Error(
      'The original PDF viewer could not open. You can still use Open original file.',
    );
  }
}
