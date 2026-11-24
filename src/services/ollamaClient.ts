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
    const payload: {
      role: 'user' | 'assistant' | 'tool';
      content: string;
      images?: string[];
      tool_calls?: OllamaToolCall[];
      tool_name?: string;
    } = {
      role: msg.role,
      content: msg.content,
    };
    if (msg.images && msg.images.length > 0) {
      payload.images = msg.images.map((img) => img.base64);
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

  const fromVal = (args.from || parsed?.from || '').trim();
  if (fromVal) body.from = fromVal;
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
