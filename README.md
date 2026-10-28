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

PDF extraction, semantic search, AI answers, market feeds, backtesting, platform observation, risk enforcement, and trading are **future work**. A source reference is a metadata citation, not proof that a claim is correct. A user-recorded test result has not been independently verified.

## Built-in Windows updates — version 0.3.0

Install the NSIS **Setup** executable once to enable updates (an extracted ZIP or development checkout is not an installed app). Open **Settings & storage → App updates**. Installed Windows builds check public GitHub Releases about 15 seconds after launch; an available-update banner links to Settings. You choose **Download**, then **Restart to install**, with a final confirmation. Closing the app normally does not automatically install an update.

Before restarting, a complete saved library (including chat) is exported into `pre-update-backups` under the app's user-data directory. A failed backup prevents installation. Save unsent drafts first. Updates keep the same app ID, package name, and local data location. Export an off-device backup before the first upgrade as well. Pre-update snapshots are retained separately from the rotating 20 library backups; manage those copies carefully.

Updates come from stable releases of the public `Ravi98-byte/trademe` repository. The app sends update/version requests to GitHub; no notes or chats are included in those requests and no GitHub token is embedded. electron-updater handles TLS downloads, metadata SHA-512 checks, version comparison, and installer handoff. Signature verification has not been disabled, but no signing certificate/publisher identity is configured yet, so these unsigned builds have no independent publisher-signature guarantee. Windows may show an unsigned-app warning. Do not describe this first release as code-signed or a fully Windows-validated updater.

The first bootstrap release has to be installed manually. The complete installed-Windows download/restart/upgrade cycle remains to be tested with two published versions. See [release process](docs/updates.md).

## Research chat — version 0.2.0

Open **Research chat** to keep a question and its researched replies in the same thread. Until an AI engine is connected, use **Create manual test question**, enter the missing information and why it is needed, then choose **Copy question for ChatGPT**. Paste it into ChatGPT yourself, research the answer, and return to **Your reply** in TradeMe. Add a source/reference when possible and click **Save reply**. Replies are labelled user-provided and unverified. They do not grant trading authority or trigger actions. There is no automatic AI generation, browser research, ChatGPT connection, or follow-up in this release.

Questions, replies, sources, and timestamps persist locally in the existing library file and are included in automatic/exported backups. Version 1 libraries without questions continue to load unchanged; no destructive migration is performed. A badge counts threads awaiting their first reply. Saved threads can be deleted with confirmation, but copies may remain in prior backups. Unsent drafts are not saved; switching threads warns before discarding a draft. Moving to another page or closing the app can discard unsaved drafts. No secrets or account credentials should be entered here.

This is the first part of the next milestone. PDF import, page-level document search, and in-app backup restoration remain pending.

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

The installer appears in `release/`. The installer bundles the Electron runtime; end users need neither Node nor Python. Windows packaging and installer execution must be validated on Windows. Code signing is not configured; distributing an unsigned installer may trigger Windows warnings. No installer has been released or signed.

`npm run test:desktop` runs an isolated real-Electron workflow test (native file dialogs are stubbed in the test process). A Windows CI workflow also builds an unsigned installer; it has not been run on GitHub yet.

`npm run package` builds an unpacked application for the current OS. Do not use Electron's `--no-sandbox` flag. Headless Linux requires system GUI libraries and a display server to launch Electron; a browser preview alone does not test desktop integration.

## Windows development ZIP

The Linux cross-build can produce `release/TradeMe-0.3.0-win.zip` without the Wine-dependent NSIS installer step:

```sh
npm run dist -- --win zip --x64 --publish never -c.win.signAndEditExecutable=false
```

On Windows, extract the entire ZIP into a folder, then open `TradeMe.exe` inside it. Keep all the accompanying files together. This unsigned development bundle retains the default Electron icon and has not yet been launched on Windows. It bundles its runtime, so it does not require Node or Python. Do not use this early version as the only copy of valuable notes.

## Local data and backup

Electron's `userData` directory contains `knowledge/library.json`. On Windows this normally lives under `%APPDATA%/trademe-desktop/knowledge`; the app's Settings page displays the actual path. Notes are kept outside the source checkout and are not committed to Git.

Automatic backups in `knowledge/backups/` retain the previous 20 saved versions; they are not a replacement for an off-device backup. Use **Export a backup** after important changes and protect exported files. There is no cloud sync and no application-level encryption. Enable Windows disk encryption and keep your OS account secure. Do not store account passwords in notes.

To restore: close the app, copy the current `library.json` somewhere safe, replace it with a verified exported backup, and reopen. Confirm the expected entries before continuing. The application refuses to overwrite an unreadable or unsupported library. Version 1 is the first schema; future schema migrations must first preserve a backup and include migration tests.

## Project map

- `src/`: desktop interface and shared contract.
- `electron/`: trusted desktop process, restricted bridge, local library storage.
- `tests/`: storage, validation, concurrency, corruption, and backup tests.
- `docs/architecture.md`: boundaries, decisions, and delivery plan.
- `docs/validation.md`: what has actually been checked and remaining platform checks.

The app uses only narrow IPC commands: list/save/delete notes, choose a text file, export a backup, and report the storage directory. The renderer cannot access Node, arbitrary files, accounts, or execution services. No external navigation or windows are allowed.
