# Clinic EMR – desktop app (Electron)

Wraps the React production build in Electron and packages it as an NSIS
installer for Windows 10/11 (x64). Like the Android app, the UI is bundled
and all data goes to the hosted backend baked into the web build via
`REACT_APP_BACKEND_URL`.

## Build

```bash
cd frontend
npm install --legacy-peer-deps
REACT_APP_BACKEND_URL=https://<backend-host> GENERATE_SOURCEMAP=false npm run build
cd ../desktop
npm install
npm run dist            # copies ../frontend/build -> app/, then electron-builder
```

Output: `dist/Clinic EMR Setup <version>.exe` (per-user install, no admin
needed; Desktop + Start Menu shortcuts).

`npm start` runs the app unpackaged for a quick check.

## Notes

- Bump `version` in `package.json` for each release (shown in the installer
  name and in Windows "Apps & features").
- The installer is not code-signed, so Windows SmartScreen shows
  "Unknown publisher" on first run (More info → Run anyway). A code-signing
  certificate would remove that.
- On Windows, electron-builder needs the `winCodeSign` toolkit extracted in
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`. Its
  archive contains macOS symlinks that fail to extract without admin rights;
  extract it once manually with `node_modules/7zip-bin/win/x64/7za.exe`
  (the two `.dylib` symlink errors are harmless) or enable Windows Developer Mode.
- `main.js` serves the build from a private `app://` scheme so React Router
  deep links work, allows the microphone (dictation), opens external links in
  the default browser, and always shows a Save dialog for exports/backups.
  `window.print()` works natively (prescriptions/forms).

## macOS and Linux installers

`.dmg` (macOS) and `.AppImage` / `.deb` (Linux) cannot be built on Windows
(DMG needs Apple's `hdiutil`, deb needs `fpm`, AppImage needs symlink rights).
They are built by the GitHub Actions workflow `.github/workflows/desktop-installers.yml`,
which runs on every push touching `desktop/` or `frontend/`, or on demand from
the repo's **Actions → Desktop installers → Run workflow** (where the backend
URL can be overridden). Download the installers from the run's *Artifacts*.

The macOS app is unsigned/not notarized: on first launch right-click the app →
**Open** (or `xattr -d com.apple.quarantine "/Applications/Clinic EMR.app"`).
Notarizing needs an Apple Developer account.
