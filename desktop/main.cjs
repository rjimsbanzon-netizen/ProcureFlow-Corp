'use strict';

const path = require('node:path');
const { app, BrowserWindow, Menu, session, shell } = require('electron');
const { APP_URL, isAppUrl, isExternalUrl } = require('./url-policy.cjs');

let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function openOutsideApp(url) {
  // Never forward file://, javascript:, data:, or arbitrary URL schemes to the OS.
  if (isExternalUrl(url)) {
    void shell.openExternal(url).catch(() => {});
  }
}

function loadProcureFlow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  void mainWindow.loadURL(APP_URL).catch(() => {});
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open in Browser', click: () => void shell.openExternal(APP_URL) },
      { type: 'separator' },
      { role: 'quit' }
    ] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ] },
    { label: 'View', submenu: [
      { label: 'Reload ProcureFlow', accelerator: 'CmdOrCtrl+R', click: loadProcureFlow },
      { role: 'togglefullscreen' }
    ] }
  ]));
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'procureflow-mark.png')
    : path.resolve(__dirname, '../src/procureflow-mark.png');

  mainWindow = new BrowserWindow({
    title: 'ProcureFlow Enterprise',
    width: 1360,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#f4f0e8',
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  });

  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    openOutsideApp(url);
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());

  function restrictNavigation(event, url) {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openOutsideApp(url);
  }
  contents.on('will-navigate', restrictNavigation);
  contents.on('will-redirect', restrictNavigation);

  contents.on('did-fail-load', (_event, errorCode, _description, failedUrl, isMainFrame) => {
    // -3 = ERR_ABORTED, as when a new navigation replaces a previous one.
    if (errorCode === -3 || !isMainFrame || !isAppUrl(failedUrl)) return;
    void mainWindow.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  loadProcureFlow();
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.pfcorp.procureflow');

  // The hosted website is untrusted web content: don't grant device permissions.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  installMenu();
  if (hasSingleInstanceLock) createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && hasSingleInstanceLock) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
