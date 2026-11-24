const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
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

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let relPath = urlPath.replace(/^\/+/, '');
        if (!relPath) relPath = 'index.html';

        // Prevent path traversal while supporting ASAR & normal filesystem
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
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'nimchesko AI studio',
    autoHideMenuBar: true,
    backgroundColor: '#14070B',
    webPreferences: {
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
