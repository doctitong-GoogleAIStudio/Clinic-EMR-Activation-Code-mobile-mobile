// Copies the React production build (frontend/build) into desktop/app so
// electron-builder can package it. Build the frontend first:
//   cd frontend && npm run build:android   (or `npm run build` with REACT_APP_BACKEND_URL set)
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', '..', 'frontend', 'build');
const dest = path.resolve(__dirname, '..', 'app');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error(`No frontend build found at ${src}. Run the frontend build first.`);
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
// The service worker is not used in the desktop shell.
fs.rmSync(path.join(dest, 'service-worker.js'), { force: true });
console.log(`Copied ${src} -> ${dest}`);
