import type {
  ChatMessage,
  ConnectionDiagnostic,
  ModelParameters,
  OllamaChatMetrics,
  OllamaShowResponse,
  OllamaTagsResponse,
  OllamaToolCall,
  ProjectContextItem,
  ProjectEnvVar,
  SkillModule,
  SystemConnector,
} from '../types/ollama';
import {
  collectVisionBase64,
  formatMessageWithFiles,
} from './fileUploads';

export function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://localhost:11434';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export interface ProjectBrainComposition {
  projectName?: string;
  brainPrompt?: string;
  rulesMarkdown?: string;
  rulesEnabled?: boolean;
  contextItems?: ProjectContextItem[];
  envVars?: ProjectEnvVar[];
}

export function composeSystemPrompt(
  basePrompt: string,
  skills: SkillModule[],
  projectBrain?: ProjectBrainComposition
): string {
  const parts: string[] = [];

  if (projectBrain?.brainPrompt && projectBrain.brainPrompt.trim()) {
    const header = projectBrain.projectName
      ? `Project Brain (${projectBrain.projectName}):`
      : 'Project Brain:';
    parts.push(`${header}\n${projectBrain.brainPrompt.trim()}`);
  }

  if (
    projectBrain?.rulesEnabled !== false &&
    projectBrain?.rulesMarkdown &&
    projectBrain.rulesMarkdown.trim()
  ) {
    parts.push(`Project Rules (rules.md):\n\n${projectBrain.rulesMarkdown.trim()}`);
  }

  const activeContext = (projectBrain?.contextItems || []).filter(
    (c) => c.enabled && c.content.trim()
  );
  if (activeContext.length > 0) {
    const contextBlocks = activeContext.map((c) => {
      const label = c.filename ? `${c.title.trim() || c.filename} (${c.filename})` : c.title.trim() || 'Resource';
      return `### Resource: ${label}\n${c.content.trim()}`;
    });
    parts.push(`Project Resources & Context:\n\n${contextBlocks.join('\n\n')}`);
  }

  const activeSkills = skills.filter((s) => s.enabled && s.instructions.trim());
  if (activeSkills.length > 0) {
    const skillBlocks = activeSkills.map(
      (s) => `### Skill: ${s.name}\n${s.instructions.trim()}`
    );
    parts.push(
      `Active Project Skills:\n\n${skillBlocks.join('\n\n')}`
    );
  }

  if (basePrompt.trim()) {
    parts.push(`Thread Instructions:\n${basePrompt.trim()}`);
  }

  return parts.join('\n\n');
}

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

export function buildOllamaToolsSchema(
  connectors: SystemConnector[]
): OllamaToolDefinition[] {
  return connectors
    .filter((c) => c.enabled && c.name.trim())
    .map((c) => {
      const properties: Record<string, { type: string; description: string }> = {};
      const required: string[] = [];

      for (const param of c.parameters) {
        if (!param.name.trim()) continue;
        properties[param.name.trim()] = {
          type: param.type,
          description: param.description || param.name,
        };
        if (param.required) {
          required.push(param.name.trim());
        }
      }

      return {
        type: 'function',
        function: {
          name: c.name.trim(),
          description: c.description || c.label,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      };
    });
}

function safeEvaluateMath(expression: string): number {
  const cleaned = expression.trim();
  if (!cleaned || cleaned.length > 160) {
    throw new Error('Expression is empty or exceeds maximum length.');
  }

  const stripped = cleaned.replace(
    /\b(sqrt|pow|round|floor|ceil|abs|min|max|sin|cos|tan|log|PI|E)\b/g,
    ''
  );
  if (!/^[0-9+\-*/%().,\s]+$/.test(stripped)) {
    throw new Error('Expression contains unsupported tokens.');
  }

  const scoped = cleaned
    .replace(/\b(sqrt|pow|round|floor|ceil|abs|min|max|sin|cos|tan|log)\b/g, 'Math.$1')
    .replace(/\b(PI|E)\b/g, 'Math.$1');

  const fn = new Function(`"use strict"; return (${scoped});`);
  const value = fn() as unknown;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expression did not evaluate to a finite number.');
  }
  return value;
}

function interpolateTemplate(
  template: string,
  args: Record<string, unknown>,
  encodeUriValues: boolean,
  envVars: ProjectEnvVar[] = []
): string {
  const envMap = new Map<string, string>();
  for (const item of envVars) {
    if (item.key.trim()) {
      envMap.set(item.key.trim(), item.value);
    }
  }

  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    if (key.startsWith('env.')) {
      const envKey = key.slice(4);
      const envVal = envMap.get(envKey) ?? '';
      return encodeUriValues && !/^https?:\/\//i.test(envVal)
        ? encodeURIComponent(envVal)
        : envVal;
    }

    const raw = args[key];
    if (raw === undefined || raw === null) {
      if (envMap.has(key)) {
        const envVal = envMap.get(key) ?? '';
        return encodeUriValues && !/^https?:\/\//i.test(envVal)
          ? encodeURIComponent(envVal)
          : envVal;
      }
      return '';
    }
    const str = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    return encodeUriValues ? encodeURIComponent(str) : str;
  });
}

export async function executeSystemConnector(
  connector: SystemConnector,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  envVars: ProjectEnvVar[] = []
): Promise<{ ok: boolean; durationMs: number; output: string }> {
  const started = performance.now();

  try {
    if (connector.kind === 'builtin') {
      if (connector.builtinId === 'current_datetime') {
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const result = {
          iso: now.toISOString(),
          local: now.toLocaleString(),
          timezone: tz,
          unixSeconds: Math.floor(now.getTime() / 1000),
        };
        return {
          ok: true,
          durationMs: performance.now() - started,
          output: JSON.stringify(result, null, 2),
        };
      }

      if (connector.builtinId === 'evaluate_math') {
        const expr = String(args.expression ?? '');
        const value = safeEvaluateMath(expr);
        return {
          ok: true,
          durationMs: performance.now() - started,
          output: JSON.stringify({ expression: expr, result: value }, null, 2),
        };
      }

      if (connector.builtinId === 'fetch_url_json') {
        const targetUrl = String(args.url ?? '').trim();
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Only http:// and https:// URLs are permitted.');
        }
        const res = await fetch(parsed.toString(), { method: 'GET', signal });
        const text = await res.text();
        let body: unknown = text.slice(0, 6000);
        try {
          body = JSON.parse(text);
        } catch {
          // Keep truncated plain text
        }
        return {
          ok: res.ok,
          durationMs: performance.now() - started,
          output: JSON.stringify({ status: res.status, ok: res.ok, body }, null, 2),
        };
      }

      throw new Error(`Unknown built-in tool: ${connector.builtinId}`);
    }

    // Custom HTTP / REST System Connector
    const rawUrl = (connector.url || '').trim();
    if (!rawUrl) {
      throw new Error('Connector URL is empty.');
    }

    let finalUrl = interpolateTemplate(rawUrl, args, true, envVars);
    const parsedUrl = new URL(finalUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Connector URL must use http:// or https://');
    }

    const method = connector.method || 'POST';
    const headers: Record<string, string> = {};

    if (connector.headersJson && connector.headersJson.trim()) {
      const interpolatedHeaders = interpolateTemplate(
        connector.headersJson,
        args,
        false,
        envVars
      );
      const parsedHeaders = JSON.parse(interpolatedHeaders) as Record<string, string>;
      for (const [k, v] of Object.entries(parsedHeaders)) {
        headers[k] = String(v);
      }
    }

    if (method === 'GET') {
      for (const [key, val] of Object.entries(args)) {
        if (!rawUrl.includes(`{{${key}}}`) && val !== undefined && val !== null) {
          parsedUrl.searchParams.set(
            key,
            typeof val === 'object' ? JSON.stringify(val) : String(val)
          );
        }
      }
      finalUrl = parsedUrl.toString();
    }

    const fetchInit: RequestInit = {
      method,
      headers,
      signal,
    };

    if (method !== 'GET') {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      if (connector.bodyTemplate && connector.bodyTemplate.trim()) {
        fetchInit.body = interpolateTemplate(
          connector.bodyTemplate,
          args,
          false,
          envVars
        );
      } else {
        fetchInit.body = JSON.stringify(args);
      }
    }

    const response = await fetch(finalUrl, fetchInit);
    const rawText = await response.text();
    let parsedBody: unknown = rawText.slice(0, 8000);
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // Keep text response if non-JSON
    }

    return {
      ok: response.ok,
      durationMs: performance.now() - started,
      output: JSON.stringify(
        {
          status: response.status,
          ok: response.ok,
          data: parsedBody,
        },
        null,
        2
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connector execution failed';
    return {
      ok: false,
      durationMs: performance.now() - started,
      output: JSON.stringify({ error: message }, null, 2),
    };
  }
}

export async function probeOllamaConnection(
  rawBaseUrl: string,
  signal?: AbortSignal
): Promise<ConnectionDiagnostic> {
  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(rawBaseUrl);
    new URL(baseUrl);
  } catch {
    return {
      status: 'error',
      models: [],
      checkedAt: Date.now(),
      errorTitle: 'Invalid endpoint URL',
      errorDetail: 'Enter a valid HTTP or HTTPS URL such as http://localhost:11434.',
      probableCause: 'invalid_url',
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal,
    });

    if (!response.ok) {
      return {
        status: 'error',
        models: [],
        checkedAt: Date.now(),
        errorTitle: `HTTP ${response.status} from Ollama`,
        errorDetail: `The server at ${baseUrl} responded with status ${response.status} ${response.statusText}.`,
        probableCause: 'http_error',
      };
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return {
      status: 'connected',
      models: Array.isArray(data.models) ? data.models : [],
      checkedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }

    const isHttpsPage =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isTargetHttpLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);

    if (isHttpsPage && isTargetHttpLocal) {
      return {
        status: 'error',
        models: [],
        checkedAt: Date.now(),
        errorTitle: 'Blocked by CORS, Private Network Access, or daemon offline',
        errorDetail:
          'Browsers block requests from an HTTPS origin to http://localhost:11434 unless Ollama permits the origin (OLLAMA_ORIGINS="*") and Chrome Private Network Access allows loopback, or you run this app locally / use an HTTPS tunnel.',
        probableCause: 'cors_or_pna',
      };
    }

    return {
      status: 'error',
      models: [],
      checkedAt: Date.now(),
      errorTitle: 'Cannot reach Ollama server',
      errorDetail:
        err instanceof Error
          ? `${err.message}. Verify Ollama is running and OLLAMA_ORIGINS permits this origin.`
          : 'Network request failed. Verify Ollama is running on the configured host and port.',
      probableCause: 'unreachable',
    };
  }
}

interface StreamChatArgs {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  params: ModelParameters;
  tools?: OllamaToolDefinition[];
  signal: AbortSignal;
  onChunk: (payload: {
    content: string;
    thinking: string;
    toolCalls?: OllamaToolCall[];
  }) => void;
  onComplete: (result: {
    metrics: OllamaChatMetrics;
    toolCalls?: OllamaToolCall[];
  }) => void;
}

interface OllamaStreamLine {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  error?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

function extractInlineThought(rawText: string): { content: string; thinking: string } {
  const openTag = '<thought>';
  const closeTag = '</thought>';
  const startIdx = rawText.indexOf(openTag);
  if (startIdx === -1) {
    return { content: rawText, thinking: '' };
  }

  const endIdx = rawText.indexOf(closeTag, startIdx + openTag.length);
  if (endIdx === -1) {
    const before = rawText.slice(0, startIdx);
    const inside = rawText.slice(startIdx + openTag.length);
    return { content: before, thinking: inside };
  }

  const before = rawText.slice(0, startIdx);
  const inside = rawText.slice(startIdx + openTag.length, endIdx);
  const after = rawText.slice(endIdx + closeTag.length).replace(/^\s+/, '');
  return {
    content: `${before}${after}`,
    thinking: inside,
  };
}

export async function streamOllamaChat({
  baseUrl,
  model,
  systemPrompt,
  messages,
  params,
  tools,
  signal,
  onChunk,
  onComplete,
}: StreamChatArgs): Promise<void> {
  const normalizedUrl = normalizeBaseUrl(baseUrl);

  const apiMessages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    images?: string[];
    tool_calls?: OllamaToolCall[];
    tool_name?: string;
  }> = [];

  if (systemPrompt.trim()) {
    apiMessages.push({
      role: 'system',
      content: systemPrompt.trim(),
    });
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const mergedContent = formatMessageWithFiles(msg.content, msg.files);
    const mergedImages = collectVisionBase64(msg.images, msg.files);
    const payload: {
      role: 'user' | 'assistant' | 'tool';
      content: string;
      images?: string[];
      tool_calls?: OllamaToolCall[];
      tool_name?: string;
    } = {
      role: msg.role,
      content: mergedContent,
    };
    if (mergedImages.length > 0) {
      payload.images = mergedImages;
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      payload.tool_calls = msg.toolCalls;
    }
    if (msg.role === 'tool' && msg.toolName) {
      payload.tool_name = msg.toolName;
    }
    apiMessages.push(payload);
  }

  const requestBody: Record<string, unknown> = {
    model: model.trim(),
    messages: apiMessages,
    stream: true,
    keep_alive: params.keepAlive || '15m',
    options: {
      temperature: params.temperature,
      top_p: params.topP,
      num_ctx: params.numCtx,
    },
  };

  if (params.jsonMode) {
    requestBody.format = 'json';
  }

  if (params.thinkMode) {
    requestBody.think = true;
  }

  if (params.toolsEnabled && tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(`${normalizedUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const errJson = (await response.json()) as { error?: string };
      if (errJson?.error) detail = errJson.error;
    } catch {
      // Ignore parse failure
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error('Ollama returned an empty response stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let rawContentAcc = '';
  let rawThinkingAcc = '';
  let collectedToolCalls: OllamaToolCall[] = [];
  let finalMetrics: OllamaChatMetrics = {};

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: OllamaStreamLine;
    try {
      parsed = JSON.parse(trimmed) as OllamaStreamLine;
    } catch {
      return;
    }

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    if (parsed.message?.thinking) {
      rawThinkingAcc += parsed.message.thinking;
    }
    if (parsed.message?.content) {
      rawContentAcc += parsed.message.content;
    }
    if (parsed.message?.tool_calls && parsed.message.tool_calls.length > 0) {
      collectedToolCalls = [...collectedToolCalls, ...parsed.message.tool_calls];
    }

    const inlineExtracted = extractInlineThought(rawContentAcc);
    const combinedThinking = [rawThinkingAcc, inlineExtracted.thinking]
      .filter(Boolean)
      .join('\n');

    onChunk({
      content: inlineExtracted.content,
      thinking: combinedThinking,
      toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
    });

    if (parsed.done) {
      const evalDurationSec = parsed.eval_duration
        ? parsed.eval_duration / 1e9
        : undefined;
      const tokensPerSecond =
        parsed.eval_count && evalDurationSec && evalDurationSec > 0
          ? parsed.eval_count / evalDurationSec
          : undefined;

      finalMetrics = {
        totalDurationMs: parsed.total_duration
          ? parsed.total_duration / 1e6
          : undefined,
        loadDurationMs: parsed.load_duration
          ? parsed.load_duration / 1e6
          : undefined,
        promptEvalCount: parsed.prompt_eval_count,
        evalCount: parsed.eval_count,
        evalDurationMs: parsed.eval_duration
          ? parsed.eval_duration / 1e6
          : undefined,
        tokensPerSecond,
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  onComplete({
    metrics: finalMetrics,
    toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
  });
}

export interface PullOrCreateProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface ParsedModelfile {
  from?: string;
  system?: string;
  template?: string;
  parameters: Record<string, string | number | boolean>;
}

export function parseModelfileText(raw: string): ParsedModelfile {
  const result: ParsedModelfile = { parameters: {} };
  const lines = raw.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const fromMatch = trimmed.match(/^FROM\s+(.+)$/i);
    if (fromMatch) {
      result.from = fromMatch[1].trim().replace(/^["']|["']$/g, '');
      i++;
      continue;
    }

    const blockDirective = trimmed.match(/^(SYSTEM|TEMPLATE)\s+("""|")([\s\S]*)$/i);
    if (blockDirective) {
      const directive = blockDirective[1].toUpperCase();
      const quote = blockDirective[2];
      let content = blockDirective[3];
      if (quote === '"""') {
        if (content.endsWith('"""') && content.length >= 3) {
          content = content.slice(0, -3);
        } else {
          const collected = [content];
          i++;
          while (i < lines.length) {
            const line = lines[i];
            const closeIdx = line.indexOf('"""');
            if (closeIdx !== -1) {
              collected.push(line.slice(0, closeIdx));
              break;
            }
            collected.push(line);
            i++;
          }
          content = collected.join('\n');
        }
      } else if (content.endsWith('"')) {
        content = content.slice(0, -1);
      }

      if (directive === 'SYSTEM') result.system = content.trim();
      if (directive === 'TEMPLATE') result.template = content.trim();
      i++;
      continue;
    }

    const paramMatch = trimmed.match(/^PARAMETER\s+([a-zA-Z0-9_]+)\s+(.+)$/i);
    if (paramMatch) {
      const key = paramMatch[1];
      const rawVal = paramMatch[2].trim().replace(/^["']|["']$/g, '');
      const num = Number(rawVal);
      if (rawVal === 'true') result.parameters[key] = true;
      else if (rawVal === 'false') result.parameters[key] = false;
      else if (!Number.isNaN(num) && rawVal !== '') result.parameters[key] = num;
      else result.parameters[key] = rawVal;
    }

    i++;
  }

  return result;
}

async function consumeOllamaStatusStream(
  response: Response,
  onProgress: (p: PullOrCreateProgress) => void
): Promise<void> {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const errJson = (await response.json()) as { error?: string };
      if (errJson?.error) detail = errJson.error;
    } catch {
      // Ignore parse failure
    }
    throw new Error(detail);
  }

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: PullOrCreateProgress & { error?: string };
    try {
      parsed = JSON.parse(trimmed) as PullOrCreateProgress & { error?: string };
    } catch {
      return;
    }
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (parsed.status) {
      onProgress({
        status: parsed.status,
        digest: parsed.digest,
        total: parsed.total,
        completed: parsed.completed,
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);
}

// Incremental SHA-256 (FIPS 180-4) so multi-GB .gguf files hash in small chunks without OOM
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

class IncrementalSha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private block = new Uint8Array(64);
  private blockLen = 0;
  private totalBytes = 0;
  private w = new Uint32Array(64);

  update(chunk: Uint8Array) {
    this.totalBytes += chunk.length;
    let offset = 0;
    while (offset < chunk.length) {
      const take = Math.min(64 - this.blockLen, chunk.length - offset);
      this.block.set(chunk.subarray(offset, offset + take), this.blockLen);
      this.blockLen += take;
      offset += take;
      if (this.blockLen === 64) {
        this.compress(this.block);
        this.blockLen = 0;
      }
    }
  }

  private compress(b: Uint8Array) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = i * 4;
      w[i] = ((b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b0, c, d, e, f, g, h0] = this.h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h0 + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b0) ^ (a & c) ^ (b0 & c);
      const temp2 = (S0 + maj) >>> 0;
      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b0;
      b0 = a;
      a = (temp1 + temp2) >>> 0;
    }
    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b0) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
    this.h[5] = (this.h[5] + f) >>> 0;
    this.h[6] = (this.h[6] + g) >>> 0;
    this.h[7] = (this.h[7] + h0) >>> 0;
  }

  digestHex(): string {
    this.block[this.blockLen++] = 0x80;
    if (this.blockLen > 56) {
      this.block.fill(0, this.blockLen, 64);
      this.compress(this.block);
      this.blockLen = 0;
    }
    this.block.fill(0, this.blockLen, 56);
    const bitLen = BigInt(this.totalBytes) * 8n;
    const view = new DataView(this.block.buffer);
    view.setBigUint64(56, bitLen, false);
    this.compress(this.block);

    return Array.from(this.h)
      .map((val) => val.toString(16).padStart(8, '0'))
      .join('');
  }
}

export async function computeFileSha256(
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const chunkSize = 4 * 1024 * 1024;
  const hasher = new IncrementalSha256();
  let offset = 0;

  while (offset < file.size) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const slice = file.slice(offset, offset + chunkSize);
    const buf = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buf));
    offset += buf.byteLength;
    if (onProgress && file.size > 0) {
      onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
    }
  }

  return `sha256:${hasher.digestHex()}`;
}

export async function uploadOllamaBlob(
  rawBaseUrl: string,
  file: File,
  onProgress?: (status: string, pct?: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  onProgress?.(`Hashing ${file.name}...`, 0);
  const digest = await computeFileSha256(
    file,
    (pct) => onProgress?.(`Hashing ${file.name} (${pct}%)...`, pct),
    signal
  );

  onProgress?.(`Checking Ollama blob cache (${digest.slice(0, 18)}...)`);
  const headRes = await fetch(`${baseUrl}/api/blobs/${digest}`, {
    method: 'HEAD',
    signal,
  });

  if (headRes.status === 200) {
    onProgress?.(`Blob already present in Ollama (${digest.slice(0, 18)}...)`, 100);
    return digest;
  }

  onProgress?.(`Uploading ${file.name} (${formatBytes(file.size) || `${file.size} B`}) to Ollama...`);
  const uploadRes = await fetch(`${baseUrl}/api/blobs/${digest}`, {
    method: 'POST',
    body: file,
    signal,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(
      errText || `Failed to upload local file blob to Ollama (HTTP ${uploadRes.status}).`
    );
  }

  return digest;
}

export async function pullOllamaModel(
  rawBaseUrl: string,
  modelName: string,
  onProgress: (progress: PullOrCreateProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const response = await fetch(`${baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName.trim(), stream: true }),
    signal,
  });
  await consumeOllamaStatusStream(response, onProgress);
}

export async function createOllamaModel(
  rawBaseUrl: string,
  args: {
    model: string;
    from?: string;
    modelfile?: string;
    files?: Record<string, string>;
    system?: string;
    parameters?: Record<string, string | number | boolean>;
  },
  onProgress: (progress: PullOrCreateProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const parsed = args.modelfile ? parseModelfileText(args.modelfile) : undefined;
  const body: Record<string, unknown> = {
    model: args.model.trim(),
    stream: true,
  };

  if (args.files && Object.keys(args.files).length > 0) {
    body.files = args.files;
  } else {
    const fromVal = (args.from || parsed?.from || '').trim();
    if (fromVal) body.from = fromVal;
  }

  const sysVal = (args.system || parsed?.system || '').trim();
  if (sysVal) body.system = sysVal;
  if (parsed?.template) body.template = parsed.template;

  const mergedParams = {
    ...(parsed?.parameters || {}),
    ...(args.parameters || {}),
  };
  if (Object.keys(mergedParams).length > 0) {
    body.parameters = mergedParams;
  }

  const response = await fetch(`${baseUrl}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  await consumeOllamaStatusStream(response, onProgress);
}

export async function showOllamaModel(
  rawBaseUrl: string,
  modelName: string,
  signal?: AbortSignal
): Promise<OllamaShowResponse> {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const response = await fetch(`${baseUrl}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName.trim() }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} inspecting ${modelName}`);
  }
  return (await response.json()) as OllamaShowResponse;
}

export async function deleteOllamaModel(
  rawBaseUrl: string,
  modelName: string,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const response = await fetch(`${baseUrl}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName.trim() }),
    signal,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status} deleting ${modelName}`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json?.error) detail = json.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(detail);
  }
}
