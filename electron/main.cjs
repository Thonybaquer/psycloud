const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;

function readWindowState() {
  try {
    const p = path.join(app.getPath('userData'), 'window-state.json');
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeWindowState(bounds) {
  try {
    const p = path.join(app.getPath('userData'), 'window-state.json');
    fs.writeFileSync(p, JSON.stringify(bounds, null, 2), 'utf8');
  } catch {
    // ignore
  }
}


function getEncryptionConfigPath() {
  return path.join(app.getPath('userData'), 'db-encryption.json');
}

function readEncryptionConfig() {
  try {
    const p = getEncryptionConfigPath();
    if (!fs.existsSync(p)) return { enabled: false };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { enabled: false };
  }
}

function writeEncryptionConfig(cfg) {
  fs.writeFileSync(getEncryptionConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

function deriveKey(passphrase, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  return crypto.pbkdf2Sync(passphrase, salt, 200000, 32, 'sha256');
}

function encryptFile(plainPath, encPath, key) {
  const iv = crypto.randomBytes(12);
  const data = fs.readFileSync(plainPath);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  // File format: PSYENC1 + iv(12) + tag(16) + ciphertext
  fs.writeFileSync(encPath, Buffer.concat([Buffer.from('PSYENC1'), iv, tag, ciphertext]));
}

function decryptFile(encPath, plainPath, key) {
  const buf = fs.readFileSync(encPath);
  const magic = buf.subarray(0, 6).toString('utf8');
  if (magic !== 'PSYENC1') throw new Error('Invalid encrypted file');
  const iv = buf.subarray(6, 18);
  const tag = buf.subarray(18, 34);
  const ciphertext = buf.subarray(34);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  fs.writeFileSync(plainPath, plain);
}

function ensureDbDecrypted() {
  const cfg = readEncryptionConfig();
  if (!cfg.enabled) return { enabled: false };
  const dbPath = process.env.SQLITE_DB_PATH;
  const encPath = dbPath + '.enc';
  if (!fs.existsSync(encPath)) return { enabled: false };
  if (!cfg.encryptedPassphrase || !safeStorage.isEncryptionAvailable()) return { enabled: false };
  const passphrase = safeStorage.decryptString(Buffer.from(cfg.encryptedPassphrase, 'base64'));
  const key = deriveKey(passphrase, cfg.salt);
  // If plaintext db exists already, keep it.
  if (!fs.existsSync(dbPath)) {
    decryptFile(encPath, dbPath, key);
  }
  return { enabled: true };
}

function ensureDbEncryptedOnExit() {
  const cfg = readEncryptionConfig();
  if (!cfg.enabled) return;
  const dbPath = process.env.SQLITE_DB_PATH;
  const encPath = dbPath + '.enc';
  if (!fs.existsSync(dbPath)) return;
  if (!cfg.encryptedPassphrase || !safeStorage.isEncryptionAvailable()) return;
  const passphrase = safeStorage.decryptString(Buffer.from(cfg.encryptedPassphrase, 'base64'));
  const key = deriveKey(passphrase, cfg.salt);
  encryptFile(dbPath, encPath, key);
  try { fs.unlinkSync(dbPath); } catch {}
}

async function createNextServer() {
  // Keep all writable data in userData (works on Win/Mac/Linux)
  const userData = app.getPath('userData');
  process.env.SQLITE_DB_PATH = path.join(userData, 'psycloud.db');
  // If DB encryption is enabled, decrypt before starting Next server.
  try { ensureDbDecrypted(); } catch (e) { console.error('DB decrypt failed:', e); }
  process.env.UPLOADS_DIR = path.join(userData, 'uploads');

  const dev = !app.isPackaged;
  const next = require('next');

  // app.getAppPath() points to the packaged app root (or project root in dev)
  const dir = app.getAppPath();

  const nextApp = next({ dev, dir });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = http.createServer((req, res) => handle(req, res));

  // Use a random free port
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, port };
}



// -------------------------
// IPC: Backup / Restore DB
// -------------------------
ipcMain.handle('db:export', async () => {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) throw new Error('DB path not set');
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar respaldo',
    defaultPath: 'psycloud-backup.db',
    filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.copyFileSync(dbPath, filePath);
  return { ok: true, filePath };
});

ipcMain.handle('db:import', async () => {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) throw new Error('DB path not set');
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restaurar respaldo',
    properties: ['openFile'],
    filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
  const src = filePaths[0];
  // Replace DB file and relaunch app
  fs.copyFileSync(src, dbPath);
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

// -------------------------
// DB encryption (AES-GCM)
// -------------------------
ipcMain.handle('db:encrypt:status', async () => {
  const cfg = readEncryptionConfig();
  return { ok: true, enabled: Boolean(cfg.enabled) };
});

ipcMain.handle('db:encrypt:enable', async (_evt, args) => {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) throw new Error('DB path not set');
  const pin = String(args?.pin ?? '');
  if (!pin || pin.length < 4) throw new Error('PIN required');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption not available');
  const salt = crypto.randomBytes(16).toString('base64');
  const key = deriveKey(pin, salt);

  const encPath = dbPath + '.enc';
  if (fs.existsSync(dbPath)) {
    encryptFile(dbPath, encPath, key);
    try { fs.unlinkSync(dbPath); } catch {}
  } else if (!fs.existsSync(encPath)) {
    // Nothing to encrypt yet; create empty DB file now so we can encrypt next time
    fs.writeFileSync(dbPath, '');
    encryptFile(dbPath, encPath, key);
    try { fs.unlinkSync(dbPath); } catch {}
  }

  const encryptedPassphrase = safeStorage.encryptString(pin).toString('base64');
  writeEncryptionConfig({ enabled: true, salt, encryptedPassphrase });
  // Reload app so Next server re-opens DB
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

ipcMain.handle('db:encrypt:disable', async () => {
  const cfg = readEncryptionConfig();
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) throw new Error('DB path not set');
  const encPath = dbPath + '.enc';
  if (cfg.enabled && fs.existsSync(encPath) && cfg.encryptedPassphrase && safeStorage.isEncryptionAvailable()) {
    const passphrase = safeStorage.decryptString(Buffer.from(cfg.encryptedPassphrase, 'base64'));
    const key = deriveKey(passphrase, cfg.salt);
    decryptFile(encPath, dbPath, key);
    try { fs.unlinkSync(encPath); } catch {}
  }
  writeEncryptionConfig({ enabled: false });
  return { ok: true };
});

async function createWindow() {
  const { port } = await createNextServer();

  const state = readWindowState();
  const width = state?.width ?? 1200;
  const height = state?.height ?? 800;
  const x = state?.x;
  const y = state?.y;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      // Keep Node out of the renderer for security
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.on('close', () => {
    try {
      const b = mainWindow.getBounds();
      writeWindowState({ x: b.x, y: b.y, width: b.width, height: b.height });
    } catch {}
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);

// Ensure the plaintext DB never remains on disk when encryption is enabled.
app.on('before-quit', () => {
  try {
    ensureDbEncryptedOnExit();
  } catch (e) {
    console.error('DB encrypt on exit failed:', e);
  }
});

// Extra Electron hardening.
app.on('web-contents-created', (_event, contents) => {
  try {
    // Disallow window.open by default.
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Lock down dangerous permissions.
    const ses = contents.session;
    ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));

    // Block navigation to external origins.
    contents.on('will-navigate', (e, url) => {
      try {
        const u = new URL(url);
        if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
          e.preventDefault();
        }
      } catch {
        e.preventDefault();
      }
    });
  } catch {
    // ignore
  }
});

app.on('window-all-closed', () => {
  // On macOS it's common to keep the app open until Cmd+Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
