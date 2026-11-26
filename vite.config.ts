import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import JSZip from 'jszip';
import os from 'os';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const COMBINED_ZIP_NAME = 'nimchesko-ai-studio-app.zip';

function addDirectoryToZip(zip: JSZip, dirPath: string, rootPath: string): void {
  const entries = fs.readdirSync(dirPath, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name.endsWith('.zip') || entry.name === 'aistudio') continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).split(path.sep).join('/');
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, rootPath);
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath);
      const isShellScript = entry.name.endsWith('.sh');
      zip.file(relPath, content, {
        unixPermissions: isShellScript ? '755' : '644',
      });
    }
  }
}

export default defineConfig(() => {
  const rawBase = (process.env.VITE_BASE || '/').trim();
  const appBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return {
    base: appBase,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: appBase,
          name: 'nimchesko AI studio',
          short_name: 'nimchesko AI',
          description:
            'Cross-platform local AI studio, multi-model comparison workbench, and Ollama/GGUF workspace.',
          theme_color: '#6B1D2F',
          background_color: '#F6EFE4',
          display: 'standalone',
          start_url: appBase,
          scope: appBase,
          icons: [
            {
              src: `${appBase}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${appBase}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${appBase}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/guide\.html$/i, /nimchesko-ai-studio-app\.zip$/i],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: process.env.DISABLE_HMR !== 'true',
          type: 'classic',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      {
        name: 'package-combined-app-zip',
        enforce: 'post',
        closeBundle: {
          sequential: true,
          order: 'post',
          async handler(error?: Error): Promise<void> {
            if (error) {
              return;
            }
            const distDir = path.resolve(__dirname, 'dist');
            const publicDir = path.resolve(__dirname, 'public');
            if (!fs.existsSync(distDir)) {
              return;
            }
            const zip = new JSZip();
            addDirectoryToZip(zip, distDir, distDir);
            const buffer = await zip.generateAsync({
              type: 'nodebuffer',
              compression: 'DEFLATE',
              compressionOptions: {level: 6},
              platform: 'UNIX',
            });
            fs.writeFileSync(path.join(distDir, COMBINED_ZIP_NAME), buffer);
            if (fs.existsSync(publicDir)) {
              fs.writeFileSync(path.join(publicDir, COMBINED_ZIP_NAME), buffer);
            }
          },
        },
        configureServer(server) {
          server.middlewares.use(`/${COMBINED_ZIP_NAME}`, (_req, res, next) => {
            const publicZip = path.resolve(__dirname, 'public', COMBINED_ZIP_NAME);
            const distZip = path.resolve(__dirname, 'dist', COMBINED_ZIP_NAME);
            const target = fs.existsSync(publicZip)
              ? publicZip
              : fs.existsSync(distZip)
                ? distZip
                : null;
            if (!target) {
              return next();
            }
            const data = fs.readFileSync(target);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${COMBINED_ZIP_NAME}"`
            );
            res.setHeader('Content-Length', String(data.length));
            res.end(data);
          });

          server.middlewares.use('/api/desktop-files/save', (req, res, next) => {
            if (req.method !== 'POST') return next();
            const host = String(req.headers.host || '');
            const isLoopback = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
            if (!isLoopback) {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false, reason: 'remote_host' }));
              return;
            }
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                  folderName?: string;
                  fileName?: string;
                  content?: string;
                };
                const safeFolder = String(body.folderName || 'Hyper Mode Markdown Files')
                  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
                  .replace(/\.\.+/g, '.')
                  .trim() || 'Hyper Mode Markdown Files';
                let safeFile = String(body.fileName || 'untitled.md')
                  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
                  .replace(/\.\.+/g, '.')
                  .trim() || 'untitled.md';
                if (!safeFile.toLowerCase().endsWith('.md')) {
                  safeFile = `${safeFile}.md`;
                }
                const targetDir = path.join(os.homedir(), 'Desktop', safeFolder);
                fs.mkdirSync(targetDir, { recursive: true });
                const filePath = path.join(targetDir, safeFile);
                fs.writeFileSync(filePath, String(body.content || ''), 'utf8');
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ ok: true, dirPath: targetDir, filePath }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ ok: false, error: String(err) }));
              }
            });
          });
        },
      },
      {
        name: 'disable-hmr-client-ws-guard',
        apply: 'serve',
        transform(code: string, id: string) {
          if (process.env.DISABLE_HMR !== 'true') {
            return null;
          }
          const normalizedId = id.split('?')[0].replace(/\\/g, '/');
          if (!normalizedId.endsWith('/vite/dist/client/client.mjs')) {
            return null;
          }
          return code
            .replace(
              'ws.send(JSON.stringify(data));',
              'if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));'
            )
            .replace('await wsTransport.connect(handlers);', 'return;');
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
