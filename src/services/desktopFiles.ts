export const HYPER_FOLDER_NAME = 'Hyper Mode Markdown Files';
export const JOURNAL_FOLDER_NAME = 'Journal & Skill Mode';

export interface DesktopDirectoryHandleLike {
  name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<DesktopDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
  queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

export interface NimcheskoDesktopBridge {
  isElectron?: boolean;
  platform?: string;
  saveDesktopMarkdown?: (payload: {
    folderName: string;
    fileName: string;
    content: string;
  }) => Promise<{ ok: boolean; filePath?: string; folderPath?: string; error?: string }>;
  openDesktopFolder?: (
    folderName: string
  ) => Promise<{ ok: boolean; folderPath?: string; error?: string }>;
  getDesktopPaths?: () => Promise<{
    desktopPath: string;
    hyperFolder: string;
    journalFolder: string;
  }>;
}

declare global {
  interface Window {
    nimcheskoDesktop?: NimcheskoDesktopBridge;
  }
}

export interface DesktopSaveResult {
  ok: boolean;
  method: 'electron' | 'vite-server' | 'directory-picker' | 'browser-download';
  savedPath: string;
  folderName: string;
  fileName: string;
  error?: string;
}

export function sanitizeMarkdownFilename(rawName: string, fallback = 'untitled'): string {
  const stripped = rawName
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${stripped || fallback}.md`;
}

export function triggerMarkdownDownload(fileName: string, content: string): void {
  const safe = sanitizeMarkdownFilename(fileName);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  a.click();
  URL.revokeObjectURL(url);
}

export async function linkDesktopDirectory(): Promise<DesktopDirectoryHandleLike | null> {
  const win = window as unknown as {
    showDirectoryPicker?: (opts?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: string;
    }) => Promise<DesktopDirectoryHandleLike>;
  };
  if (!win.showDirectoryPicker) return null;
  try {
    return await win.showDirectoryPicker({
      id: 'nimchesko-desktop-folder',
      mode: 'readwrite',
      startIn: 'desktop',
    });
  } catch {
    return null;
  }
}

export async function openDesktopSubfolder(folderName: string): Promise<boolean> {
  if (typeof window !== 'undefined' && window.nimcheskoDesktop?.openDesktopFolder) {
    const res = await window.nimcheskoDesktop.openDesktopFolder(folderName);
    return Boolean(res?.ok);
  }
  return false;
}

export async function saveMarkdownToDesktopFolder(args: {
  folderName: string;
  fileName: string;
  content: string;
  desktopDirHandle?: DesktopDirectoryHandleLike | null;
  fallbackDownload?: boolean;
}): Promise<DesktopSaveResult> {
  const safeFile = sanitizeMarkdownFilename(args.fileName);

  // 1. Electron desktop app native IPC
  if (typeof window !== 'undefined' && window.nimcheskoDesktop?.saveDesktopMarkdown) {
    try {
      const res = await window.nimcheskoDesktop.saveDesktopMarkdown({
        folderName: args.folderName,
        fileName: safeFile,
        content: args.content,
      });
      if (res.ok && res.filePath) {
        return {
          ok: true,
          method: 'electron',
          savedPath: res.filePath,
          folderName: args.folderName,
          fileName: safeFile,
        };
      }
    } catch {
      // Fall through to HTTP bridge or browser picker
    }
  }

  // 2. Local Electron HTTP bridge or Vite dev server middleware (/api/desktop-files/save)
  if (
    typeof window !== 'undefined' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)
  ) {
    try {
      const res = await fetch('/api/desktop-files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: args.folderName,
          fileName: safeFile,
          content: args.content,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          filePath?: string;
        };
        if (data.ok && data.filePath) {
          return {
            ok: true,
            method: 'vite-server',
            savedPath: data.filePath,
            folderName: args.folderName,
            fileName: safeFile,
          };
        }
      }
    } catch {
      // Fall through to File System Access API
    }
  }

  // 3. Linked Desktop Directory Handle (Chrome/Edge File System Access API)
  if (args.desktopDirHandle) {
    try {
      let granted = true;
      if (args.desktopDirHandle.queryPermission) {
        const perm = await args.desktopDirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && args.desktopDirHandle.requestPermission) {
          const req = await args.desktopDirHandle.requestPermission({ mode: 'readwrite' });
          granted = req === 'granted';
        }
      }
      if (granted) {
        const subDir = await args.desktopDirHandle.getDirectoryHandle(args.folderName, {
          create: true,
        });
        const fileHandle = await subDir.getFileHandle(safeFile, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(args.content);
        await writable.close();
        return {
          ok: true,
          method: 'directory-picker',
          savedPath: `${args.desktopDirHandle.name}/${args.folderName}/${safeFile}`,
          folderName: args.folderName,
          fileName: safeFile,
        };
      }
    } catch {
      // Fall through to browser download if allowed
    }
  }

  // 4. Browser download fallback
  if (args.fallbackDownload !== false) {
    triggerMarkdownDownload(safeFile, args.content);
    return {
      ok: true,
      method: 'browser-download',
      savedPath: `Downloads/${safeFile} (target folder: Desktop/${args.folderName})`,
      folderName: args.folderName,
      fileName: safeFile,
    };
  }

  return {
    ok: false,
    method: 'browser-download',
    savedPath: '',
    folderName: args.folderName,
    fileName: safeFile,
    error: 'No direct Desktop write handle linked in browser mode.',
  };
}
