# TradeMe

A local-first desktop research workspace for Ravi's Nasdaq futures trading project. **No broker connection, live prices, AI service, paper execution, or real orders are implemented.**

## First milestone — working foundation

- Electron desktop shell, React interface, strict TypeScript.
- Local knowledge notes: create, edit, delete, search, and category filters.
- Author, source/link, date, page/timestamp, rights, and claim type preserved with every entry.
- Import `.txt` / `.md` up to 500 KB, review metadata, then save. Markdown is shown as plain text; imported content never executes.
- Store video/interview URLs as source references; no downloading, fetching, or transcription.
- Versioned local storage, atomic replacement, last 20 previous versions backed up, explicit backup export.
- Clear placeholders for future modules. No invented market data or performance results.

OCR, video transcription, semantic search, AI answers, market feeds, backtesting, platform observation, risk enforcement, and trading are **future work**. A source reference is a metadata citation, not proof that a claim is correct. A user-recorded test result has not been independently verified.

## Documents, videos, and links — version 0.4.0

In **Knowledge library**, choose **PDFs, videos & links** or **Documents & media**:

- **Import PDF**: one text-based PDF at a time, up to 25 MB, 1,500 pages, and 8 million extracted characters. Search the text and jump to matching physical PDF pages. Original PDFs are preserved. Scanned-only, encrypted/password-protected, malformed, over-limit, and timed-out PDFs report an error. OCR is not implemented. Text, tables, equations, and reading order must be checked against the original; extraction is not understanding or validation.
- **Import video**: store a local `.mp4`, `.m4v`, `.mov`, `.webm`, or `.mkv` up to 500 MB. This copies bytes only: codec support, playback, speech, and strategy content are not analysed. Open it explicitly in your system player if needed. Status remains **Transcript needed**.
- **Import transcript**: UTF-8 `.txt`, `.md`, `.srt`, or `.vtt` up to 500 KB. Text and included timestamps are searchable; text/Markdown is never executed or rendered as HTML.
- **Add link**: save a video, interview, or web/article HTTP(S) link with author/speaker, date, page/timestamp, rights, and your own context. Links are not fetched or transcribed. **Open link in browser** is a deliberate user action. An imported transcript is a separate source; use the same title or URL to find related material.

Source details can be edited while original content stays unchanged. Permission and title are required before saving. PDFs are read in a separate, time-limited Electron utility process, with PDF.js worker/font/CMap resources loaded locally and no external resource fetch. Originals are copied into `knowledge/assets` with SHA-256 names; a changed file between selection and saving is rejected. Selected-file tokens expire after 20 minutes. All selected material stays on the laptop, outside Git; no AI is connected or trained by these imports.

## Built-in Windows updates — version 0.3.0

Install the NSIS **Setup** executable once to enable updates (an extracted ZIP or development checkout is not an installed app). Open **Settings & storage → App updates**. Installed Windows builds check public GitHub Releases about 15 seconds after launch; an available-update banner links to Settings. You choose **Download**, then **Restart to install**, with a final confirmation. Closing the app normally does not automatically install an update.

Before restarting, the saved library records and extracted text (including chat) are exported into `pre-update-backups` under the app's user-data directory. A failed backup prevents installation. Save unsent drafts first. Updates keep the same app ID, package name, and local data location. Export an off-device backup before the first upgrade as well. Pre-update snapshots are retained separately from the rotating 20 library backups; manage those copies carefully.

Updates come from stable releases of the public `Ravi98-byte/trademe` repository. The app sends update/version requests to GitHub; no notes or chats are included in those requests and no GitHub token is embedded. electron-updater handles TLS downloads, metadata SHA-512 checks, version comparison, and installer handoff. Signature verification has not been disabled, but no signing certificate/publisher identity is configured yet, so these unsigned builds have no independent publisher-signature guarantee. Windows may show an unsigned-app warning. Do not describe this first release as code-signed or a fully Windows-validated updater.

The first bootstrap release has to be installed manually. The complete installed-Windows download/restart/upgrade cycle remains to be tested with two published versions. See [release process](docs/updates.md).

## Research chat — version 0.2.0

Open **Research chat** to keep a question and its researched replies in the same thread. Until an AI engine is connected, use **Create manual test question**, enter the missing information and why it is needed, then choose **Copy question for ChatGPT**. Paste it into ChatGPT yourself, research the answer, and return to **Your reply** in TradeMe. Add a source/reference when possible and click **Save reply**. Replies are labelled user-provided and unverified. They do not grant trading authority or trigger actions. There is no automatic AI generation, browser research, ChatGPT connection, or follow-up in this release.

Questions, replies, sources, and timestamps persist locally in the existing library file and are included in automatic/exported backups. Version 1 libraries without questions continue to load unchanged; no destructive migration is performed. A badge counts threads awaiting their first reply. Saved threads can be deleted with confirmation, but copies may remain in prior backups. Unsent drafts are not saved; switching threads warns before discarding a draft. Moving to another page or closing the app can discard unsaved drafts. No secrets or account credentials should be entered here.

Document import and page-level search are now available in version 0.4.0. An in-app backup restoration wizard remains pending.

## Run on Windows

Target laptop: Windows 10, Intel Core i5 7th generation (64-bit/x64). RAM and free storage are not yet confirmed.

Install **Node.js 24 LTS** for development, open PowerShell in this repository:

```powershell
npm ci
npm run setup:runtime
npm run dev
```

To check and build:

```powershell
npm test
npm run build
npm run dist:win
```

The installer appears in `release/`. The installer bundles the Electron runtime; end users need neither Node nor Python. Windows packaging and installer execution must be validated on Windows. Code signing is not configured; distributing an unsigned installer may trigger Windows warnings. Installers are produced by the Windows release workflow; no code-signing identity is configured.

`npm run test:desktop` runs an isolated real-Electron workflow test (native file dialogs are stubbed in the test process). The Windows release workflow tests and builds unsigned installers. Its current result must be checked in GitHub Actions.

`npm run package` builds an unpacked application for the current OS. Do not use Electron's `--no-sandbox` flag. Headless Linux requires system GUI libraries and a display server to launch Electron; a browser preview alone does not test desktop integration.

## Windows development ZIP

The Linux cross-build can produce `release/TradeMe-0.4.0-win.zip` without the Wine-dependent NSIS installer step:

```sh
npm run dist -- --win zip --x64 --publish never -c.win.signAndEditExecutable=false
```

On Windows, extract the entire ZIP into a folder, then open `TradeMe.exe` inside it. Keep all the accompanying files together. This unsigned development bundle retains the default Electron icon and has not yet been launched on Windows. It bundles its runtime, so it does not require Node or Python. Do not use this early version as the only copy of valuable notes.

## Local data and backup

Electron's `userData` directory contains `knowledge/library.json`. On Windows this normally lives under `%APPDATA%/trademe-desktop/knowledge`; the app's Settings page displays the actual path. Notes are kept outside the source checkout and are not committed to Git.

Automatic backups in `knowledge/backups/` retain the previous 20 saved versions; they are not a replacement for an off-device backup. Use **Export a backup** after important changes and protect exported files. There is no cloud sync and no application-level encryption. Enable Windows disk encryption and keep your OS account secure. Do not store account passwords in notes.

**Export a backup** defaults to a ZIP containing `library.json` and the current original files in `assets/`. It streams video bytes rather than loading them all into memory and checks asset hashes first. JSON-only export remains available for notes, questions, source metadata, and extracted text; it excludes original files. Automatic change backups and pre-update snapshots are JSON records, while originals stay in `knowledge/assets`. Deleted source originals are deliberately retained so previous local snapshots can still reference them. There is no automatic asset garbage collection yet; monitor disk space when importing video.

To restore a complete ZIP: close TradeMe, preserve the entire existing `knowledge` folder elsewhere, extract the trusted backup, then copy its `library.json` and `assets` folder into `knowledge`. Reopen and check notes, chats, PDF pages, and original files. An older JSON-only backup cannot recover missing original files. Do not delete your safety copy until the restoration is verified. The application refuses to overwrite an unreadable or unsupported library. Version 1 accepts additive source/question records; older note-only libraries remain compatible.

## Project map

- `src/`: desktop interface and shared contract.
- `electron/`: trusted desktop process, restricted bridge, local library storage.
- `tests/`: storage, validation, concurrency, corruption, and backup tests.
- `docs/architecture.md`: boundaries, decisions, and delivery plan.
- `docs/validation.md`: what has actually been checked and remaining platform checks.

The renderer uses narrow IPC commands for notes, sources, chat, backups, and updates. It cannot choose arbitrary file paths, access Node, or execute trades. Explicitly opening a saved source uses the OS PDF reader/video player or the default browser after the source is validated; the application window itself blocks external navigation.
