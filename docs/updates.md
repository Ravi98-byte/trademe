# Update delivery and release process

## Intended user flow

The one-time bootstrap is the **TradeMe-Setup-0.3.0-x64.exe** NSIS installer, downloaded from the v0.3.0 GitHub Release (or its workflow artifact if publication fails). An extracted ZIP cannot enable this path: installed-app detection requires `Uninstall TradeMe.exe` alongside the running executable. The same package name and app ID are retained to preserve existing user data.

An installed Windows build checks stable public GitHub Releases once after startup. A banner indicates availability. In Settings, the user downloads, sees progress, and explicitly requests restart. A native dialog confirms; a serialized library export must succeed before `quitAndInstall(false, true)` is called. Downloading alone and ordinary application exit do not install. Unsupported/dev builds explain why update controls are disabled.

This release has no trading/account connections. Before those exist, installation will need an independent check that the agent is stopped and there are no unattended operations; that future gate is not implemented now.

## Maintain the release channel

The app uses the public GitHub provider for `Ravi98-byte/trademe`. No private-source token, custom feed URL, or credentials can be supplied by the renderer. If the repository becomes private, checks/downloads fail with a recoverable message; a separate authenticated delivery design would be required. Do not put a personal access token in the app.

Ordinary pushes run CI and provide artifacts, but do not publish updates. To ship a tested version:

1. Update the package version and lockfile together (`npm version patch --no-git-tag-version` is one option), and write `docs/release-notes.md` for the new version. Version displayed by the app comes from the actual running package.
2. Run storage/updater tests, production build, and desktop smoke test. Commit and push the release commit.
3. Create and push the matching `vX.Y.Z` tag. The **Publish Windows update** job verifies tag/version agreement, runs Windows tests and a real Electron workflow, builds NSIS with electron-builder, and validates `.exe`, `.blockmap`, and `latest.yml` files.
4. The workflow first retains these as an Actions artifact, then publishes a non-prerelease GitHub Release using only the runner's scoped built-in token. A failed check prevents publication. Never reuse or move an existing release tag, and never substitute unverified assets after publication.
5. Confirm the release assets exist and test upgrade from the previous installed Windows version. Published release and a successful live upgrade are distinct outcomes.

The workflow's `contents: write` permission is limited to its release job. It needs no token on the user's laptop and no added repository secret. The signing certificate is not yet configured. SHA-512 metadata checks protect against corrupt downloads but do not substitute for a trusted publisher signature or protect against a compromised release account. Keep GitHub access protected; add Windows code signing before broader distribution.

## Validation and recovery

Current tests cover explicit download/install gating, duplicate requests, provider errors, failed download/checksum events, progress handling, backup-before-restart, and retry after backup failure. These controller tests use a fake transport; they do not prove real Windows installer behaviour or real network delivery. The desktop smoke checks the actual unsupported/development Settings view without contacting a feed.

Required Windows acceptance: manually install the bootstrap, create notes/replies, publish a newer version, check/download, cancel restart once, save drafts, install, reopen, verify the new version and preserved content. Test a disconnected check and a failed/partial download. Check that closing the app without choosing install leaves the old version running on next launch. Confirm pre-update backup readability. Code signing and real upgrade-cycle testing remain outstanding.

On a failed check or download, keep using the current app and retry from Settings. On backup failure, installation is blocked. If the installer itself fails, retain the current data folder and use a known-good installer; do not delete data as a troubleshooting step. No automatic rollback is claimed.
