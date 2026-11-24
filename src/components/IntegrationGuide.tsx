import { useState } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import type { ConnectionDiagnostic } from '../types/ollama';
import { formatBytes, normalizeBaseUrl } from '../services/ollamaClient';
import { CodeSnippetBlock } from './CodeSnippetBlock';
import { AzadiTowerMotif, SiOSePolMotif } from './PersianMotifs';

interface IntegrationGuideProps {
  projectName: string;
  baseUrl: string;
  onChangeBaseUrl: (url: string) => void;
  model: string;
  diagnostic: ConnectionDiagnostic;
  onProbeConnection: () => void;
  onBackToChat: () => void;
}

type OsPlatform = 'macos' | 'linux' | 'windows' | 'tunnel';
type CodeTab = 'react' | 'express' | 'openai' | 'curl';

export function IntegrationGuide({
  projectName,
  baseUrl,
  onChangeBaseUrl,
  model,
  diagnostic,
  onProbeConnection,
  onBackToChat,
}: IntegrationGuideProps) {
  const [osTab, setOsTab] = useState<OsPlatform>('macos');
  const [codeTab, setCodeTab] = useState<CodeTab>('react');

  const endpoint = normalizeBaseUrl(baseUrl);
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const osCommands: Record<OsPlatform, { title: string; note: string; code: string }> = {
    macos: {
      title: 'macOS (Terminal / Ollama.app)',
      note: 'Quit Ollama.app first if already running, then launch with OLLAMA_ORIGINS set.',
      code: `# Allow browser origins
launchctl setenv OLLAMA_ORIGINS "${currentOrigin},http://localhost:3000"

# Or run directly in terminal:
OLLAMA_ORIGINS="*" ollama serve

# Pull Gemma 4 12B:
ollama pull ${model}`,
    },
    linux: {
      title: 'Linux (systemd / CLI)',
      note: 'Set OLLAMA_ORIGINS in terminal or in the systemd service override.',
      code: `# Option A: Quick foreground run
OLLAMA_ORIGINS="*" ollama serve

# Option B: Persistent systemd service
sudo systemctl edit ollama.service
# Add under [Service]:
# Environment="OLLAMA_ORIGINS=*"

sudo systemctl daemon-reload
sudo systemctl restart ollama`,
    },
    windows: {
      title: 'Windows (PowerShell)',
      note: 'Quit Ollama from the tray icon before starting with OLLAMA_ORIGINS.',
      code: `# Current PowerShell session
$env:OLLAMA_ORIGINS="*"
ollama serve

# Persist for current user:
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")`,
    },
    tunnel: {
      title: 'HTTPS Tunnel (Remote UI -> Local Ollama)',
      note: 'When connecting from a public HTTPS origin to localhost, expose port 11434 over HTTPS.',
      code: `OLLAMA_ORIGINS="*" ollama serve
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"`,
    },
  };

  const reactSnippet = `// Browser streaming client for Ollama /api/chat (${model})
export async function streamGemmaChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; images?: string[] }>,
  onToken: (text: string) => void,
  signal?: AbortSignal
) {
  const res = await fetch('${endpoint}/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: '${model}',
      messages,
      stream: true,
      options: { temperature: 0.7, num_ctx: 16384 },
    }),
  });

  if (!res.ok || !res.body) throw new Error(\`Ollama error: \${res.status}\`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.message?.content) onToken(chunk.message.content);
    }
  }
}`;

  const expressSnippet = `// server.ts — Backend proxy route (eliminates browser CORS)
import express from 'express';

const app = express();
app.use(express.json({ limit: '15mb' }));

const OLLAMA_URL = process.env.OLLAMA_URL || '${endpoint}';

app.post('/api/chat', async (req, res) => {
  const upstream = await fetch(\`\${OLLAMA_URL}/api/chat\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: req.body.model || '${model}',
      messages: req.body.messages,
      stream: true,
      options: req.body.options,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return res.status(upstream.status).json({ error: 'Upstream Ollama error' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
});

app.listen(3001, () => console.log('Proxy listening on :3001'));`;

  const openaiSnippet = `# Ollama OpenAI-compatible endpoint (/v1/chat/completions)
from openai import OpenAI

client = OpenAI(base_url="${endpoint}/v1", api_key="ollama")

stream = client.chat.completions.create(
    model="${model}",
    messages=[
        {"role": "system", "content": "Respond concisely with clean technical clarity."},
        {"role": "user", "content": "Introduce Persepolis in two sentences."},
    ],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)`;

  const curlSnippet = `# 1. List local models
curl ${endpoint}/api/tags

# 2. Stream chat with ${model}
curl ${endpoint}/api/chat -d '{
  "model": "${model}",
  "messages": [
    { "role": "user", "content": "Introduce Azadi Tower in two sentences." }
  ],
  "stream": true
}'`;

  const codeSnippets: Record<CodeTab, { filename: string; lang: string; code: string }> = {
    react: { filename: 'ollamaClient.ts', lang: 'typescript', code: reactSnippet },
    express: { filename: 'server.ts', lang: 'typescript', code: expressSnippet },
    openai: { filename: 'chat_openai_sdk.py', lang: 'python', code: openaiSnippet },
    curl: { filename: 'verify_ollama.sh', lang: 'bash', code: curlSnippet },
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-10 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <AzadiTowerMotif className="h-10 w-12" />
              <SiOSePolMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                Project Endpoint · {projectName}
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Local Gemma 4 12B Integration Guide
              </h1>
              <p className="mt-2 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Ollama runs a local REST API on port <code className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 text-[#4D1422] dark:text-[#E6B8A2]">11434</code>. Connect directly from the browser with CORS enabled or through a Node/Express proxy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Chat</span>
          </button>
        </div>

        {/* Section 1: Live Connection Diagnostics */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                01. Endpoint Diagnostics
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                Probes <code className="font-mono">GET {endpoint}/api/tags</code> for {projectName}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => onChangeBaseUrl(e.target.value)}
                aria-label="Ollama Endpoint URL"
                className="h-9 w-56 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={onProbeConnection}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    diagnostic.status === 'checking' ? 'animate-spin' : ''
                  }`}
                />
                <span>Probe</span>
              </button>
            </div>
          </div>

          {diagnostic.status === 'connected' ? (
            <div className="rounded-2xl border border-[#6B1D2F]/25 dark:border-[#E6B8A2]/25 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 backdrop-blur-md p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                <CheckCircle2 className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Connected to {endpoint}</span>
              </div>
              {diagnostic.models.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 text-[#6E4A53] dark:text-[#C5AE9F]">
                        <th className="py-2 pr-4 font-medium">Model Tag</th>
                        <th className="py-2 pr-4 font-medium">Parameters</th>
                        <th className="py-2 pr-4 font-medium">Quantization</th>
                        <th className="py-2 text-right font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10 font-mono tabular-nums">
                      {diagnostic.models.map((m) => (
                        <tr key={m.name} className="text-[#2B0F17] dark:text-[#F5ECE0]">
                          <td className="py-2 pr-4 font-medium">{m.name}</td>
                          <td className="py-2 pr-4">{m.details?.parameter_size || '—'}</td>
                          <td className="py-2 pr-4">{m.details?.quantization_level || '—'}</td>
                          <td className="py-2 text-right">{formatBytes(m.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#5C3A42] dark:text-[#CEB8AE]">
                  Server responded, but no models are pulled yet. Run <code className="font-mono">ollama pull {model}</code>.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/70 backdrop-blur-md p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-[#5C3A42] dark:text-[#CEB8AE]">
                  <p className="font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    {diagnostic.errorTitle || 'Not connected yet'}
                  </p>
                  <p className="mt-1">
                    {diagnostic.errorDetail ||
                      'Click Probe once Ollama is running with CORS configured.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: CORS & Local Startup */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
              02. Configure Origins (CORS)
            </h2>
            <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5 leading-relaxed">
              Set <code className="font-mono">OLLAMA_ORIGINS</code> before launching Ollama so your browser UI can call <code className="font-mono">/api/chat</code>.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/7 p-1 border border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10">
            {(
              [
                ['macos', 'macOS'],
                ['linux', 'Linux'],
                ['windows', 'Windows'],
                ['tunnel', 'HTTPS Tunnel'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOsTab(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  osTab === key
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs text-[#5C3A42] dark:text-[#CEB8AE] mb-1">
              {osCommands[osTab].note}
            </p>
            <CodeSnippetBlock
              code={osCommands[osTab].code}
              filename={osCommands[osTab].title}
            />
          </div>
        </section>

        {/* Section 3: Integration Code Snippets */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
              03. Streaming Integration Code
            </h2>
            <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5 leading-relaxed">
              Consume NDJSON streams from <code className="font-mono">/api/chat</code> or SSE from <code className="font-mono">/v1/chat/completions</code>.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/7 p-1 border border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10">
            {(
              [
                ['react', 'React / TypeScript'],
                ['express', 'Node / Express Proxy'],
                ['openai', 'OpenAI SDK (Python)'],
                ['curl', 'cURL Test'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCodeTab(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  codeTab === key
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <CodeSnippetBlock
            code={codeSnippets[codeTab].code}
            language={codeSnippets[codeTab].lang}
            filename={codeSnippets[codeTab].filename}
          />
        </section>

        {/* Section 4: Gemma 4 12B Request Reference */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
            04. Key <code className="font-mono text-base">/api/chat</code> Fields
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-[#6B1D2F]/5 dark:bg-[#F3E7D8]/6 text-[#4D1422] dark:text-[#E6B8A2]">
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Value</th>
                  <th className="px-4 py-2.5 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10">
                <tr>
                  <td className="px-4 py-2.5 font-mono text-[#3A101B] dark:text-[#F5ECE0]">model</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">"{model}"</td>
                  <td className="px-4 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">Exact tag from <code className="font-mono">ollama list</code>.</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-[#3A101B] dark:text-[#F5ECE0]">stream</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">true</td>
                  <td className="px-4 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">Streams NDJSON token chunks until <code className="font-mono">done: true</code>.</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-[#3A101B] dark:text-[#F5ECE0]">messages[].images</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">["/9j/4AAQ..."]</td>
                  <td className="px-4 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">Base64 images (without data URI prefix) for Gemma 4 vision.</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-[#3A101B] dark:text-[#F5ECE0]">options.num_ctx</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">16384</td>
                  <td className="px-4 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">Context window size in tokens.</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-[#3A101B] dark:text-[#F5ECE0]">tools</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">[...]</td>
                  <td className="px-4 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">Function schemas for live external system calls.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Cross-Platform Compiled Web App (Windows & Linux) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                05. Cross-Platform Compiled Web App (Windows &amp; Linux)
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5 leading-relaxed max-w-2xl">
                All compiled app files, icons, offline service worker, and Windows/Linux launchers are combined into a single downloadable archive (<code className="font-mono">nimchesko-ai-studio-app.zip</code>). Extract and run directly without installing Node.js or building from source.
              </p>
            </div>
            <a
              href="/nimchesko-ai-studio-app.zip"
              download="nimchesko-ai-studio-app.zip"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0 shadow-[0_2px_10px_rgba(107,29,47,0.2)]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Combined App (.zip)</span>
            </a>
          </div>

          <CodeSnippetBlock
            filename="quick-start-windows-linux.txt"
            language="bash"
            code={`# Option A: One-Click Combined Web Package (No npm/git required)
# 1. Click "Download Combined App (.zip)" above and extract nimchesko-ai-studio-app.zip
# 2. Windows: Double-click run-windows.bat
# 3. Linux:   chmod +x run-linux.sh && ./run-linux.sh

# Option B: GitHub Actions CI/CD Native Desktop Releases
# Workflow: .github/workflows/release-desktop.yml (runs on push to main, v* tags, or manual dispatch)
# Outputs:  .deb, .rpm, .pkg.tar.zst, .tar, .tar.zst, .AppImage, .exe, and macOS .pkg

# Option C: Build from Source Locally
npm install
npm run build`}
          />
        </section>
      </div>
    </div>
  );
}
