import type { ChatAttachment, UploadedFileAttachment } from '../types/ollama';

const MAX_TEXT_CHARS = 48_000;

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'mdx', 'json', 'jsonl', 'yaml', 'yml', 'toml',
  'ini', 'env', 'cfg', 'conf', 'csv', 'tsv', 'xml', 'svg', 'html', 'htm',
  'css', 'scss', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp',
  'cs', 'php', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'dockerfile',
  'gitignore', 'gitattributes', 'log', 'tex', 'bib', 'r', 'lua', 'pl',
  'modelfile', 'skill', 'spec',
]);

function isLikelyTextFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'application/typescript' ||
    mime === 'application/x-yaml' ||
    mime === 'application/yaml' ||
    mime === 'application/csv' ||
    mime === 'application/sql' ||
    mime === 'image/svg+xml'
  ) {
    return true;
  }
  const baseName = file.name.toLowerCase();
  if (baseName === 'modelfile' || baseName === 'dockerfile' || baseName === 'makefile') {
    return true;
  }
  const ext = baseName.includes('.') ? baseName.split('.').pop() || '' : '';
  return TEXT_EXTENSIONS.has(ext);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function extractReadableStringsFromBinary(bytes: Uint8Array): string {
  // Scan up to first 1.5MB for printable ASCII/UTF-8 runs (useful for PDFs/docs/logs)
  const sample = bytes.subarray(0, Math.min(bytes.length, 1_500_000));
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const raw = decoder.decode(sample);
  const runs = raw.match(/[\u0020-\u007E\u0600-\u06FF\n\r\t]{6,}/g);
  if (!runs || runs.length === 0) return '';
  const joined = runs
    .filter((chunk) => !/^\s+$/.test(chunk))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return joined.slice(0, 12_000);
}

export async function readAnyUploadedFiles(
  fileList: FileList | File[] | null
): Promise<UploadedFileAttachment[]> {
  if (!fileList) return [];
  const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
  if (files.length === 0) return [];

  const results: UploadedFileAttachment[] = [];

  for (const file of files) {
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mimeType = file.type || 'application/octet-stream';

    if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
      const dataUrl = await readAsDataUrl(file);
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      results.push({
        id,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        kind: 'image',
        dataUrl,
        base64,
      });
      continue;
    }

    if (isLikelyTextFile(file)) {
      const fullText = await file.text();
      const truncated = fullText.length > MAX_TEXT_CHARS;
      results.push({
        id,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        kind: 'text',
        textContent: truncated ? fullText.slice(0, MAX_TEXT_CHARS) : fullText,
        truncated,
      });
      continue;
    }

    // Binary / PDF / Archive / Unknown extension: inspect bytes and extract readable strings if present
    const buffer = await file.slice(0, 1_500_000).arrayBuffer();
    const extracted = extractReadableStringsFromBinary(new Uint8Array(buffer));
    results.push({
      id,
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      kind: 'binary',
      textContent: extracted || undefined,
      truncated: file.size > 1_500_000 || extracted.length >= 12_000,
    });
  }

  return results;
}

export function formatMessageWithFiles(
  content: string,
  files?: UploadedFileAttachment[]
): string {
  if (!files || files.length === 0) return content;

  const docAttachments = files.filter((f) => f.kind !== 'image');
  if (docAttachments.length === 0) return content;

  const blocks = docAttachments.map((f) => {
    const sizeKb = f.sizeBytes >= 1024 ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : `${f.sizeBytes} B`;
    if (f.textContent && f.textContent.trim()) {
      const ext = f.name.includes('.') ? f.name.split('.').pop() || '' : '';
      return [
        `### Uploaded File: ${f.name} (${f.mimeType}, ${sizeKb})${f.truncated ? ' [truncated]' : ''}`,
        `\`\`\`${ext}`,
        f.textContent.trim(),
        `\`\`\``,
      ].join('\n');
    }
    return `### Uploaded Binary File: ${f.name} (${f.mimeType}, ${sizeKb}) — no UTF-8 text payload detected.`;
  });

  const prefix = content.trim();
  return prefix
    ? `${prefix}\n\n---\nAttached Local Files:\n\n${blocks.join('\n\n')}`
    : `Attached Local Files:\n\n${blocks.join('\n\n')}`;
}

export function collectVisionBase64(
  images?: ChatAttachment[],
  files?: UploadedFileAttachment[]
): string[] {
  const out: string[] = [];
  if (images) {
    for (const img of images) {
      if (img.base64) out.push(img.base64);
    }
  }
  if (files) {
    for (const f of files) {
      if (f.kind === 'image' && f.base64) out.push(f.base64);
    }
  }
  return out;
}
