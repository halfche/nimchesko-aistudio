const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};

let serverInstance = null;
let mainWindow = null;

function sanitizeSegment(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\.\.+/g, '.')
    .trim();
  return cleaned || fallback;
}

function getDesktopBaseDir() {
  try {
    return app.getPath('desktop');
  } catch {
    return path.join(os.homedir(), 'Desktop');
  }
}

function saveMarkdownToDesktop({ folderName, fileName, content }) {
  const safeFolder = sanitizeSegment(folderName, 'Hyper Mode Markdown Files');
  let safeFile = sanitizeSegment(fileName, 'untitled.md');
  if (!safeFile.toLowerCase().endsWith('.md')) {
    safeFile = `${safeFile}.md`;
  }

  const desktopRoot = getDesktopBaseDir();
  const targetDir = path.join(desktopRoot, safeFolder);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, safeFile);
  fs.writeFileSync(targetFile, String(content || ''), 'utf8');
  return { ok: true, dirPath: targetDir, filePath: targetFile };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

        if (req.method === 'POST' && urlPath === '/api/desktop-files/save') {
          const body = await readJsonBody(req);
          const result = saveMarkdownToDesktop(body || {});
          const payload = JSON.stringify(result);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(payload),
          });
          res.end(payload);
          return;
        }

        if (req.method === 'POST' && urlPath === '/api/desktop-files/open') {
          const body = await readJsonBody(req);
          const safeFolder = sanitizeSegment(body?.folderName, 'Hyper Mode Markdown Files');
          const targetDir = path.join(getDesktopBaseDir(), safeFolder);
          fs.mkdirSync(targetDir, { recursive: true });
          await shell.openPath(targetDir);
          const payload = JSON.stringify({ ok: true, dirPath: targetDir });
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(payload),
          });
          res.end(payload);
          return;
        }

        let relPath = urlPath.replace(/^\/+/, '');
        if (!relPath) relPath = 'index.html';

        const normalized = path.posix.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
        let targetPath = path.join(DIST_DIR, normalized);

        let isFile = false;
        try {
          isFile = fs.statSync(targetPath).isFile();
        } catch {
          isFile = false;
        }

        if (!isFile) {
          targetPath = path.join(DIST_DIR, 'index.html');
        }

        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const data = fs.readFileSync(targetPath);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
        });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(err));
      }
    });

    let retriedEphemeral = false;
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && !retriedEphemeral) {
        retriedEphemeral = true;
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          resolve({ server, port: addr.port });
        });
        return;
      }
      reject(err);
    });

    server.listen(4173, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function createWindow() {
  const { server, port } = await startStaticServer();
  serverInstance = server;

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'nimchesko AI studio',
    autoHideMenuBar: true,
    backgroundColor: '#14070B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('desktop:save-markdown', async (_event, payload) => {
  return saveMarkdownToDesktop(payload || {});
});

ipcMain.handle('desktop:open-folder', async (_event, payload) => {
  const safeFolder = sanitizeSegment(payload?.folderName, 'Hyper Mode Markdown Files');
  const targetDir = path.join(getDesktopBaseDir(), safeFolder);
  fs.mkdirSync(targetDir, { recursive: true });
  await shell.openPath(targetDir);
  return { ok: true, dirPath: targetDir };
});

ipcMain.handle('desktop:get-paths', async () => {
  const desktopDir = getDesktopBaseDir();
  return {
    desktopDir,
    hyperDir: path.join(desktopDir, 'Hyper Mode Markdown Files'),
    journalDir: path.join(desktopDir, 'Journal & Skill Mode'),
  };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (serverInstance) {
      serverInstance.close();
      serverInstance = null;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
