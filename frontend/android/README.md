# Clinic EMR – Android app (Capacitor)

The Android app is the React frontend bundled into a WebView via Capacitor 6.
It talks to the hosted backend; the URL is baked in at build time through
`REACT_APP_BACKEND_URL` (see `build:android` in `../package.json`).
Production backend: https://emr-licensing-gate.emergent.host

## Build

Requirements: Node 18+, JDK 17, Android SDK (platform 36, build-tools 35).
Point Gradle at the SDK with `android/local.properties` (`sdk.dir=...`).

```bash
cd frontend
npm install --legacy-peer-deps
npm run build:android                # React build + cap sync
cd android && ./gradlew assembleRelease bundleRelease
```

Outputs:

- APK: `app/build/outputs/apk/release/app-release.apk`
- AAB (Play Store): `app/build/outputs/bundle/release/app-release.aab`

## Signing

`android/keystore.properties` (git-ignored) holds the release key details:

```
storeFile=../../../clinic-emr-release.keystore
storePassword=...
keyAlias=clinicemr
keyPassword=...
```

Every Play Store update must be signed with the same key.

## Releasing an update

1. Bump `versionCode` (+1) and `versionName` in `app/build.gradle`.
2. Rebuild as above and upload the `.aab` in Play Console.

## Native bridges

- `NativePrintPlugin.java` – the WebView cannot `window.print()`; the print
  preview hands its HTML to the Android print dialog (Print / Save as PDF).
- `MainActivity.java` – edge-to-edge inset handling for Android 15+ and the
  brand-coloured status bar.
- `src/native/index.js` (web side) – routes blob downloads (backups, CSV
  exports, attachments) and PDF viewing through the Android share sheet.
