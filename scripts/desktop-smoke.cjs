// Run after npm run build. Linux needs a display (for example DISPLAY=:99).
// Native file dialogs are stubbed only in this test process; real IPC and disk storage are exercised.
const { _electron: electron } = require('playwright');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const assert = require('node:assert/strict');
const { makePdf } = require('../tests/fixtures/pdf.cjs');
const { unzipSync } = require('fflate');
(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trademe-desktop-'));
  let app;
  try {
    const launch = () =>
      electron.launch({
        chromiumSandbox: true,
        ...(process.env.SMOKE_EXECUTABLE
          ? { executablePath: process.env.SMOKE_EXECUTABLE }
          : {}),
        args: [
          ...(process.env.SMOKE_EXECUTABLE ? [] : [resolve('.')]),
          `--user-data-dir=${dir}`,
        ],
        env: { ...process.env },
        timeout: 30000,
      });
    app = await launch();
    // Electron's userData path must be isolated before writing any test note.
    const userData = await app.evaluate(({ app }) => app.getPath('userData'));
    assert.equal(
      resolve(userData),
      resolve(dir),
      'Test must not touch the real user library',
    );
    let win = await app.firstWindow();
    const errors = [];
    win.on('pageerror', (error) => errors.push(error.message));
    await win
      .getByRole('heading', { name: 'Knowledge library', exact: true })
      .waitFor();
    await win.getByRole('button', { name: 'Create your first note' }).click();
    await win
      .getByLabel('Title *', { exact: true })
      .fill('Smoke: source-aware research');
    await win
      .getByLabel('Note content *', { exact: true })
      .fill('Research hypothesis only. No trade authorization.');
    await win.getByLabel('Author', { exact: true }).fill('Ravi');
    await win
      .getByLabel('Source title or URL')
      .fill('https://example.com/interview');
    await win.getByLabel('Page or timestamp').fill('00:12:30');
    await win.getByLabel('Rights / permission *').fill('My own notes');
    await win.getByRole('button', { name: 'Save note', exact: true }).click();
    await win
      .getByRole('heading', {
        name: 'Smoke: source-aware research',
        exact: true,
      })
      .first()
      .waitFor();
    await win.getByLabel('Search library').fill('does-not-match');
    await win.getByRole('heading', { name: 'No matching notes' }).waitFor();
    await win.getByLabel('Search library').fill('');
    await win.getByRole('button', { name: 'Edit note', exact: true }).click();
    await win
      .getByLabel('Title *', { exact: true })
      .fill('Smoke: revised research');
    await win.getByRole('button', { name: 'Save note', exact: true }).click();
    await win
      .getByRole('heading', { name: 'Smoke: revised research', exact: true })
      .first()
      .waitFor();
    const imported = join(dir, 'permitted-notes.txt');
    const backup = join(dir, 'export.json');
    await writeFile(imported, 'My permitted interview notes.');
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, imported);
    await win.getByRole('button', { name: 'Import text', exact: true }).click();
    await win.getByLabel('Rights / permission *').fill('My original writing');
    await win.getByRole('button', { name: 'Save note', exact: true }).click();
    await win
      .getByRole('heading', { name: 'permitted-notes', exact: true })
      .first()
      .waitFor();
    await win.getByRole('button', { name: /^Research chat/ }).click();
    await win
      .getByRole('button', { name: 'Create manual test question' })
      .click();
    await win
      .getByLabel('Question *', { exact: true })
      .fill('Which source verifies the rule?');
    await win
      .getByLabel('Why is this information needed? *')
      .fill('A source is missing.');
    await win
      .getByRole('button', { name: 'Save test question', exact: true })
      .click();
    await win
      .getByRole('heading', {
        name: 'Which source verifies the rule?',
        exact: true,
      })
      .waitFor();
    await win
      .getByRole('button', { name: 'Copy question for ChatGPT' })
      .click();
    await win
      .getByRole('status')
      .filter({ hasText: 'Question copied' })
      .waitFor();
    assert.ok(
      (await app.evaluate(({ clipboard }) => clipboard.readText())).includes(
        'A source is missing.',
      ),
    );
    await win
      .getByLabel('Your reply *', { exact: true })
      .fill('This still needs verification.');
    await win
      .getByLabel('Source / reference (optional)')
      .fill('ChatGPT research, unverified');
    await win.getByRole('button', { name: 'Save reply', exact: true }).click();
    await win.getByRole('status').filter({ hasText: 'Reply saved' }).waitFor();
    await win
      .getByText('User-provided · Not independently verified', { exact: true })
      .waitFor();
    await win.getByRole('button', { name: /^Knowledge library/ }).click();
    const pdfPath = join(dir, 'smoke-pdf.pdf');
    await writeFile(pdfPath, makePdf());
    await win
      .getByRole('button', { name: 'PDFs, videos & links', exact: true })
      .click();
    const choose = async (path) =>
      app.evaluate(({ dialog }, p) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [p],
        });
      }, path);
    await choose(pdfPath);
    await win.getByRole('button', { name: 'Import PDF', exact: true }).click();
    await win
      .getByLabel('Source title *', { exact: true })
      .waitFor({ timeout: 50000 });
    await win
      .getByLabel('Rights / permission *', { exact: true })
      .fill('Original generated test PDF');
    await win.getByLabel('Author / speaker', { exact: true }).fill('Ravi');
    await win.getByRole('button', { name: 'Save source', exact: true }).click();
    await win
      .locator('.source-reader h2')
      .filter({ hasText: 'smoke-pdf' })
      .waitFor();
    await win.getByLabel('Search documents and media').fill('slippage');
    await win.getByLabel('PDF page number').waitFor();
    await win.waitForFunction(
      () =>
        document.querySelector('[aria-label="PDF page number"]').value === '2',
    );
    assert.ok(
      (await win.locator('.extracted-text').textContent()).includes('slippage'),
    );
    await win
      .getByRole('button', { name: 'Edit source details', exact: true })
      .click();
    await win
      .getByLabel('Source title *', { exact: true })
      .fill('Smoke PDF revised');
    await win.getByLabel('Source date', { exact: true }).fill('2026-10-27');
    await win.getByRole('button', { name: 'Save source', exact: true }).click();
    await win
      .locator('.source-reader h2')
      .filter({ hasText: 'Smoke PDF revised' })
      .waitFor();
    await win.getByLabel('Search documents and media').fill('');
    const videoPath = join(dir, 'lesson.mp4');
    await writeFile(videoPath, 'local storage fixture, no decoding attempted');
    await choose(videoPath);
    await win
      .getByRole('button', { name: 'Import video', exact: true })
      .click();
    await win
      .getByLabel('Rights / permission *', { exact: true })
      .fill('My original video');
    await win.getByRole('button', { name: 'Save source', exact: true }).click();
    await win
      .getByText('Stored locally · Transcript needed', { exact: true })
      .first()
      .waitFor();
    const transcriptPath = join(dir, 'lesson.vtt');
    await writeFile(transcriptPath, '00:12:30 Research needs testing.');
    await choose(transcriptPath);
    await win
      .getByRole('button', { name: 'Import transcript', exact: true })
      .click();
    await win
      .getByLabel('Rights / permission *', { exact: true })
      .fill('My own transcript');
    await win.getByRole('button', { name: 'Save source', exact: true }).click();
    await win
      .getByText('Transcript text imported', { exact: true })
      .first()
      .waitFor();
    await win.getByRole('button', { name: 'Add link', exact: true }).click();
    await win.getByLabel('Link type').selectOption('interview-link');
    await win
      .getByLabel('Source title *', { exact: true })
      .fill('Smoke interview reference');
    await win
      .getByLabel('Source URL *', { exact: true })
      .fill('https://example.com/interview');
    await win
      .getByLabel('Rights / permission *', { exact: true })
      .fill('Link reference only');
    await win.getByLabel('Page / video timestamp').fill('00:12:30');
    await win.getByRole('button', { name: 'Save source', exact: true }).click();
    await win
      .getByText('Link saved · Content not retrieved', { exact: true })
      .first()
      .waitFor();
    const sources = await win.evaluate(() => window.trademe.listSources());
    assert.equal(sources.value.length, 4);
    const expired = await win.evaluate(() =>
      window.trademe.saveSourceFile('forged', {}),
    );
    assert.equal(expired.ok, false);
    await win.evaluate(() => window.scrollTo(0, 0));
    await win.screenshot({ path: join(dir, 'sources.png'), fullPage: true });
    await win.getByRole('button', { name: /^Notes \(/ }).click();
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, backup);
    await win
      .getByRole('button', { name: 'Export a backup', exact: true })
      .click();
    await win
      .getByRole('status')
      .filter({ hasText: 'Backup exported' })
      .waitFor();
    const exported = JSON.parse(await readFile(backup, 'utf8'));
    assert.equal(exported.entries.length, 2);
    assert.equal(exported.sources.length, 4);
    const zipPath = join(dir, 'complete.zip');
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, zipPath);
    await win
      .getByRole('button', { name: 'Export a backup', exact: true })
      .click();
    await win
      .getByRole('status')
      .filter({ hasText: 'Backup exported' })
      .waitFor();
    const zipFiles = unzipSync(await readFile(zipPath));
    assert.equal(Object.keys(zipFiles).length, 4);
    assert.equal(
      JSON.parse(new TextDecoder().decode(zipFiles['library.json'])).sources
        .length,
      4,
    );
    assert.equal(
      exported.questions[0].replies[0].source,
      'ChatGPT research, unverified',
    );
    assert.equal(exported.entries[1].locator, '00:12:30');
    await win.evaluate(() => window.scrollTo(0, 0));
    await win.screenshot({ path: join(dir, 'workspace.png') });
    await app.close();
    app = await launch();
    win = await app.firstWindow();
    win.on('pageerror', (error) => errors.push(error.message));
    await win
      .getByRole('heading', { name: 'permitted-notes', exact: true })
      .waitFor();
    await win
      .getByRole('heading', { name: 'Smoke: revised research', exact: true })
      .waitFor();
    await win
      .getByRole('button', { name: 'permitted-notes', exact: false })
      .click();
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await win.getByRole('button', { name: 'Delete note', exact: true }).click();
    await win
      .getByRole('heading', { name: 'permitted-notes', exact: true })
      .first()
      .waitFor({ state: 'detached' });
    assert.equal(
      JSON.parse(await readFile(join(dir, 'knowledge/library.json'), 'utf8'))
        .entries.length,
      1,
    );
    await win.getByRole('button', { name: /^Research chat/ }).click();
    await win
      .getByText('This still needs verification.', { exact: true })
      .waitFor();
    await win
      .getByRole('heading', {
        name: 'Which source verifies the rule?',
        exact: true,
      })
      .waitFor();
    await win.evaluate(() => window.scrollTo(0, 0));
    await win.screenshot({
      path: join(dir, 'research-chat.png'),
      fullPage: true,
    });
    await win
      .getByRole('button', { name: 'Settings & storage', exact: true })
      .click();
    await win
      .getByRole('heading', { name: 'App updates', exact: true })
      .waitFor();
    await win
      .getByText(
        'Updates are available in the installed Windows application.',
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await win
        .getByRole('button', { name: 'Check for updates', exact: true })
        .isDisabled(),
      true,
    );
    const unsupported = await win.evaluate(() =>
      window.trademe.installUpdate(),
    );
    assert.equal(unsupported.value.phase, 'unsupported');
    assert.equal(
      unsupported.value.currentVersion,
      require('../package.json').version,
    );
    await win.getByRole('button', { name: /^Knowledge library/ }).click();
    await win
      .getByRole('button', { name: 'PDFs, videos & links', exact: true })
      .click();
    await win
      .getByRole('button', { name: /PDF document Smoke PDF revised/ })
      .click();
    assert.equal(
      (await win.evaluate(() => window.trademe.listSources())).value.length,
      4,
    );
    await win.getByRole('button', { name: 'Next page', exact: true }).click();
    assert.ok(
      (await win.locator('.extracted-text').textContent()).includes('slippage'),
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: actual Electron create, search, edit, text import, export, restart persistence, delete, research question/reply, clipboard/chat backup, PDF pages/search, media/link import, original files and complete ZIP backup; no renderer errors.',
    );
    console.log('Isolated test artifacts:', dir);
  } finally {
    if (app) await app.close();
    if (!process.env.KEEP_SMOKE_ARTIFACTS)
      await rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
