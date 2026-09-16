// Clinic EMR – Windows desktop shell.
//
// Serves the React production build (copied into ./app by `npm run prepare-app`)
// from a private app:// scheme so BrowserRouter deep links work, and talks to the
// hosted backend through the REACT_APP_BACKEND_URL baked into that build.
const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_DIR = path.join(__dirname, 'app');
const APP_ORIGIN = 'app://clinic-emr';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// Single instance: a second launch just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

// Map app://clinic-emr/<path> to a file in the build; unknown paths fall back to
// index.html (single-page app routing).
function resolveAppFile(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl).pathname);
  const candidate = path.normalize(path.join(APP_DIR, pathname));
  const inside = candidate.startsWith(APP_DIR + path.sep) || candidate === APP_DIR;
  if (inside && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  return path.join(APP_DIR, 'index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Clinic EMR',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // The app opens PDFs from blob: URLs in a new window; everything external goes
  // to the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url.startsWith(APP_ORIGIN)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 800 } };
    }
    if (/^https?:/i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.loadURL(`${APP_ORIGIN}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => net.fetch(pathToFileURL(resolveAppFile(request.url)).toString()));

  // Microphone for SOAP dictation; everything else stays denied.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const origin = new URL(webContents.getURL()).origin;
    callback(origin === APP_ORIGIN && permission === 'media');
  });

  // Exports/backups: always ask where to save.
  session.defaultSession.on('will-download', (event, item) => {
    item.setSaveDialogOptions({ title: 'Save file', defaultPath: item.getFilename() });
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ])
  );

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
