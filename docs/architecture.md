# Architecture and first milestone

## Product intent

Build a polished local Windows application for NQ/MNQ research, then add integrations in tested stages. The supplied brief is product context; the user's current instruction authorizes a foundation, not a real-account connection or trades. No feature is operational merely because its navigation item exists.

## Structure in plain language

React draws the workspace. Electron supplies the native window, file picker, and future Windows installer. TypeScript helps catch disagreements between these pieces before running them. The main process owns data; a small bridge is the only route from the interface to local operations. Imported documents are data, never commands.

The first knowledge store uses a versioned JSON file. This is suitable for a small personal library, not a large document corpus. Writes run one at a time, copy the previous file, write a temporary file, then rename it into place. Automatic retention keeps 20 previous versions. It prevents partial-file replacement in ordinary failures, but is not a transactional database or a guarantee against power loss. Valuable data needs external backups. A later SQLite migration should be tested using real backup fixtures before larger-scale ingestion.

## Module boundaries

| Module               | Current state                   | Future responsibility                                                                |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| Desktop interface    | Implemented                     | Accessible workspace, permission prompts, honest connection status                   |
| Knowledge library    | Notes and text/Markdown imports | PDF extraction with page references, retrieval, cited answers                        |
| Market data          | Not implemented                 | Licensed provider adapter, entitlement/freshness metadata                            |
| Strategy research    | Not implemented                 | Reproducible datasets, costs, explicit rules, held-out evaluation                    |
| Account/risk         | Not implemented                 | Read-only verified state, exact firm/account rules, independent limits               |
| Execution            | Absent                          | Paper adapter first; separately authorized real execution only after controls        |
| Computer observation | Not implemented                 | Supported integration first; uncertainty detection, explicit permissions, audit logs |

Provider access will sit behind separate interfaces when real requirements are known. No unused provider SDKs, credentials, fake integration stubs, or execution routes are installed now. Future modules should consume validated source records rather than infer that a note or an AI answer authorizes an action.

## Milestone 1 acceptance

1. Open the actual desktop application.
2. Create a sourced note, restart, and verify it persists.
3. Search title/content/author/source/locator and filter by category.
4. Import a permitted text/Markdown file, review and save its metadata.
5. Edit/delete with backups, export a readable backup, and exercise restoration.
6. Pass meaningful automated storage tests and the production build.
7. Verify native dialogs, keyboard behavior, and installer on Windows.

Cloud checks and Windows acceptance are recorded separately. This milestone is not complete until the actual desktop workflow passes; code/build completion alone must not be represented as desktop validation.

## Next milestones

2. PDF extraction with page references and document identity; reliable retrieval and source inspection before optional semantic search. Link bookmarks work now as source metadata. Video or interview transcription needs terms, permission, and cost decisions.
3. Licensed historical data, explicit hypotheses, commissions/slippage, dataset versions, out-of-sample tests, and limitations.
4. Entitled market/news feeds and freshness, then permitted read-only platform/account information.
5. Paper execution, independent risk checks, stale-data failure paths, emergency stop, and auditability.
6. Real execution considered only with a new explicit authorization and verified broker/firm permissions.

## Open decisions

Confirmed: Windows 10, Intel Core i5 7th generation (x64 target); notes, text files, PDFs, video/interview links. Windows installer validation remains pending on the target laptop. Hardware details inform later local AI/PDF scale choices. Confirmed platforms: MFFU, TradingView, and Tradovate. The exact MFFU account variant and authoritative rules remain to be verified. Budget, live/delayed data, and AI privacy preferences are needed before their corresponding integrations. No recurring fees or external data transfers are introduced here.

## Research chat clarification

The user wants the future agent to ask for help inside the application when information is missing. The user can research in ChatGPT and paste an answer into the matching thread. Version 0.2.0 implements the local manual handoff: narrow IPC methods, validated immutable replies, source references, timestamps, pending-reply counts, clipboard copying by explicit click, and backups shared with the library. It does not invent AI questions or execute anything. `origin: manual` makes that boundary explicit. Answered means a reply was recorded, not that the claim was verified or an action approved. An eventual agent must evaluate freshness and evidence and separately enforce permissions/risk checks; no consumer of chat replies is implemented now.

The accepted next milestone remains document import and source-based search. The chat was added first at the user's request; PDF extraction and recovery UI have not been delivered yet.
