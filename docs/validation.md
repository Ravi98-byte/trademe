# Validation record

Validated in the Linux cloud development machine on 2026-10-27. These results do not establish Windows installer readiness.

| Check                                                              | Result                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| Strict TypeScript and production renderer/main/preload compilation | Passed                                               |
| Storage suite                                                      | 10 tests passed, none skipped                        |
| Actual Electron 45.1.0 workflow on a temporary Xorg dummy display  | Passed                                               |
| Create, search, edit, import text, backup export                   | Passed through real renderer/IPC/storage             |
| Restart persistence and delete confirmation path                   | Passed                                               |
| JavaScript renderer errors during tested workflow                  | None observed                                        |
| Automatic backups, retention, concurrency, corruption protection   | Passed storage tests                                 |
| Exported backup restoration to a new library directory             | Passed storage test                                  |
| npm dependency audit including development tools                   | No known vulnerabilities reported                    |
| Unpacked Linux application packaging                               | Passed                                               |
| Windows x64 application bundle                                     | Cross-build passed; not launched on Windows          |
| Windows NSIS installer                                             | Blocked on Linux by missing Wine; Windows CI not run |
| Windows execution and code signing                                 | Not run; unsigned development build                  |
| Native Windows file-picker interactions                            | Not run                                              |
| PDF, AI, market data, account integration, strategy tests, trading | Not implemented; not tested                          |

## Reproduce

```sh
npm ci
npm run setup:runtime
npm test
npm run build
npm run package
npm run test:desktop
```

The desktop smoke script uses Playwright's Electron launcher, an isolated temporary `userData` directory, and real persisted files. It asserts that data cannot be written into the user's normal library. Open/save/confirmation dialogs are stubbed inside that test process to provide deterministic file choices; the associated IPC and file operations are real. Thus the check does not validate native dialog appearance or manual selection. The script does not install dependencies or create a global display server. `KEEP_SMOKE_ARTIFACTS=1` retains its isolated files and screenshot for inspection.

Linux needs a display server and Chromium system libraries. In this cloud machine, a temporary Xorg server with its installed dummy driver provided display `:99`; no Electron sandbox bypass was used. Run the script with `DISPLAY=:99` when that server is active. Windows normally uses the interactive desktop. Restricted command sandboxes may block Electron or test process communication; the completed checks used the supported execution approval flow.

This cloud's Electron binary download required the supported `NODE_USE_ENV_PROXY=1` environment setting (Node 24) and `ELECTRON_GET_USE_PROXY=1`, preserving inherited proxy and CA settings. Electron's runtime installer and electron-builder completed without disabling checksum or TLS checks. These environment settings are specific to proxied development machines, not requirements for ordinary Windows end users.

## Before a Windows release

- Target confirmed: Windows 10, Intel Core i5 7th generation; build architecture x64.
- Run the supplied Windows CI workflow and inspect the generated unsigned installer.
- Test install, launch, native dialogs, note persistence across restart and upgrades, backup/restore, keyboard navigation, and uninstall/data retention on Windows.
- Choose a code-signing/distribution process and application icon before public distribution.
- Keep the distinction between a local build, a tested installer, and a published release explicit.

## Windows cross-build follow-up

The Windows application bundle built on Linux. NSIS installer generation failed with `spawn wine ENOENT`; Wine is unavailable on this cloud machine. This is a packaging-tool limitation, not a Windows runtime test result. The Windows-native CI workflow remains the intended installer path. No GitHub workflow has been triggered or changes pushed.

A ZIP cross-build uses `npm run dist -- --win zip --x64 --publish never -c.win.signAndEditExecutable=false`. This development-only override skips executable branding/resource edits and signing to avoid Wine for the app bundle. The default Electron icon is retained. Keep this distinct from the normal Windows-native `npm run dist:win` installer command.

Windows x64 ZIP packaging completed successfully. ZIP CRC verification passed and confirmed `TradeMe.exe` and `resources/app.asar` are present. A SHA-256 file is stored alongside the ZIP. This checks archive integrity, not Windows runtime behavior.

## Version 0.2.0 research chat

- 16 storage tests passed, none skipped: includes compatibility with existing note libraries, concurrent replies, validation, corruption protection, conversation backup/export, and deletion backups.
- Production build and strict TypeScript checks passed.
- Actual Electron smoke test passed on the Linux virtual display: manual question creation, question copying (clipboard checked), reply with source, unverified label, backup inclusion, and persistence after restart, alongside the existing note workflow.
- No renderer errors were observed during the tested workflow.
- The user supplied Windows screenshots and confirmed note persistence after restart for version 0.1.0. Version 0.2.0 still needs Windows validation. Installer execution has not been independently verified.
- Automatic AI questions, external AI calls, PDF import, and any action resumption are not implemented or tested.

## Version 0.3.0 updater

23 storage and updater-controller tests passed, none skipped. The new controller tests use a fake updater and cover user gating, failed downloads, duplicate requests, error sanitisation, backup failure, progress bounds, and backup-before-install ordering. The real Electron smoke test passed with the new Settings panel and disabled update controls in development; it verifies the running package version and that unsupported installs cannot restart. Existing library/chat checks also passed. TypeScript/production build passed; npm audit reported no known vulnerabilities after adding electron-updater.

The user confirmed the repository is public. This cloud session still receives Forbidden from GitHub's API and a 404 from its release page, so those requests cannot validate the release channel. Windows release creation, asset availability, and an actual installed-Windows upgrade cycle must be confirmed separately. No real updater download or installation is claimed from the fake-transport tests. Installer authenticity is not code-signed yet.

Unpacked Linux packaging completed with the configured public GitHub provider. The generated `resources/app-update.yml` was inspected and points to the intended owner/repository and stable release channel with no credentials. This validates packaging configuration, not Windows installation.
