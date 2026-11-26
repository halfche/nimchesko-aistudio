import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ImagePlus,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChatAttachment,
  ChatMessage,
  CompareModelResult,
  CompareRound,
  ConnectionDiagnostic,
  ImportedModelProfile,
  OllamaShowResponse,
  WorkspaceProject,
} from '../types/ollama';
import {
  composeSystemPrompt,
  formatBytes,
  showOllamaModel,
  streamOllamaChat,
} from '../services/ollamaClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  AzadiTowerMotif,
  IsfahanDomeMotif,
  PersepolisMotif,
} from './PersianMotifs';

interface CompareViewProps {
  project: WorkspaceProject;
  diagnostic: ConnectionDiagnostic;
  importedModels: ImportedModelProfile[];
  rounds: CompareRound[];
  onChangeRounds: (updater: (prev: CompareRound[]) => CompareRound[]) => void;
  onProbeConnection: () => void;
  onOpenModels: () => void;
  onOpenInChat: (model: string, prompt: string, response: string) => void;
  onBackToChat: () => void;
}

interface UnifiedLocalModel {
  name: string;
  sourceLabel: string;
  sourceKind: 'ollama' | 'file' | 'custom';
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  inOllama: boolean;
}

const BENCHMARK_PROMPTS = [
  {
    label: 'Reasoning & Logic',
    prompt:
      'A local server processes 3 models sequentially: Model A takes 1.8s load + 42 tok/s, Model B takes 0.9s load + 28 tok/s. For a 210-token output, which finishes sooner and by how many milliseconds? Show your exact steps.',
  },
  {
    label: 'TypeScript Utility',
    prompt:
      'Write a dependency-free TypeScript function `retryWithBackoff<T>(fn, maxRetries, baseDelayMs)` that handles AbortSignal cleanly and preserves strong typing.',
  },
  {
    label: 'JSON Extraction',
    prompt:
      'Extract structured JSON with keys `product`, `issues`, `severity` ("low"|"medium"|"high"), and `next_action` from: "The desktop installer launched fast on Ubuntu 24.04, but pulling a 14B Q4_K_M model timed out at 62% due to disk space."',
  },
  {
    label: 'Technical Conciseness',
    prompt:
      'Compare Q4_K_M, Q5_K_M, and Q8_0 GGUF quantization trade-offs in 4 concise bullet points covering RAM footprint, perplexity impact, and throughput.',
  },
];

function fileToAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIndex = dataUrl.indexOf(',');
      const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mimeType: file.type || 'image/png',
        dataUrl,
        base64,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function CompareView({
  project,
  diagnostic,
  importedModels,
  rounds,
  onChangeRounds,
  onProbeConnection,
  onOpenModels,
  onOpenInChat,
  onBackToChat,
}: CompareViewProps) {
  const allLocalModels = useMemo<UnifiedLocalModel[]>(() => {
    const map = new Map<string, UnifiedLocalModel>();

    for (const m of diagnostic.models) {
      map.set(m.name, {
        name: m.name,
        sourceLabel: 'Ollama',
        sourceKind: 'ollama',
        sizeBytes: m.size,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
        family: m.details?.family,
        inOllama: true,
      });
    }

    for (const prof of importedModels) {
      const existing = map.get(prof.name);
      if (existing) {
        map.set(prof.name, {
          ...existing,
          sourceLabel:
            prof.sourceType === 'gguf' || prof.sourceType === 'local-file'
              ? 'Ollama · Local File'
              : prof.sourceType === 'modelfile'
                ? 'Ollama · Modelfile'
                : existing.sourceLabel,
          parameterSize: existing.parameterSize || prof.parameterSize,
          quantization: existing.quantization || prof.quantization,
          family: existing.family || prof.family,
        });
      } else {
        map.set(prof.name, {
          name: prof.name,
          sourceLabel:
            prof.sourceType === 'gguf'
              ? 'Local GGUF'
              : prof.sourceType === 'modelfile'
                ? 'Modelfile'
                : prof.sourceType === 'local-file'
                  ? 'Local File'
                  : 'Ollama Profile',
          sourceKind:
            prof.sourceType === 'ollama' ? 'ollama' : 'file',
          sizeBytes: prof.fileSizeBytes,
          parameterSize: prof.parameterSize,
          quantization: prof.quantization,
          family: prof.family,
          inOllama: false,
        });
      }
    }

    if (project.defaultModel && !map.has(project.defaultModel)) {
      map.set(project.defaultModel, {
        name: project.defaultModel,
        sourceLabel: 'Project Tag',
        sourceKind: 'custom',
        inOllama: false,
      });
    }

    return Array.from(map.values());
  }, [diagnostic.models, importedModels, project.defaultModel]);

  const [selectedModels, setSelectedModels] = useState<string[]>(() =>
    allLocalModels.slice(0, 4).map((m) => m.name)
  );
  const [modelFilter, setModelFilter] = useState<'all' | 'ollama' | 'file'>('all');
  const [modelSearch, setModelSearch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel'>(
    'sequential'
  );
  const [includeProjectBrain, setIncludeProjectBrain] = useState(false);
  const [thinkMode, setThinkMode] = useState(project.params.thinkMode);
  const [temperature, setTemperature] = useState(project.params.temperature);
  const [isRunning, setIsRunning] = useState(false);

  const [inspectedModels, setInspectedModels] = useState<
    Record<string, OllamaShowResponse>
  >({});
  const [inspectingTag, setInspectingTag] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveSelected = useMemo(() => {
    const valid = selectedModels.filter((name) =>
      allLocalModels.some((m) => m.name === name)
    );
    if (valid.length > 0) return valid;
    return allLocalModels.slice(0, Math.min(3, allLocalModels.length)).map((m) => m.name);
  }, [selectedModels, allLocalModels]);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return allLocalModels.filter((m) => {
      if (modelFilter === 'ollama' && !m.inOllama) return false;
      if (modelFilter === 'file' && m.sourceKind !== 'file') return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.family || '').toLowerCase().includes(q) ||
        (m.quantization || '').toLowerCase().includes(q)
      );
    });
  }, [allLocalModels, modelFilter, modelSearch]);

  const lastMetricsByModel = useMemo(() => {
    const map = new Map<string, CompareModelResult>();
    for (const round of rounds) {
      for (const r of round.results) {
        if (!map.has(r.model) && r.status === 'done') {
          map.set(r.model, r);
        }
      }
    }
    return map;
  }, [rounds]);

  const toggleModelSelection = (name: string) => {
    const current = new Set(effectiveSelected);
    if (current.has(name)) {
      current.delete(name);
    } else {
      current.add(name);
    }
    setSelectedModels(Array.from(current));
  };

  const handleInspectModel = async (name: string) => {
    if (inspectedModels[name]) {
      setInspectedModels((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      return;
    }
    setInspectingTag(name);
    try {
      const data = await showOllamaModel(project.baseUrl, name);
      setInspectedModels((prev) => ({ ...prev, [name]: data }));
    } catch {
      // Ignore inspect failure if offline
    } finally {
      setInspectingTag(null);
    }
  };

  const handleAttachImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    const converted = await Promise.all(imgs.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...converted]);
  };

  const updateRoundResult = (
    roundId: string,
    modelName: string,
    updater: (prev: CompareModelResult) => CompareModelResult
  ) => {
    onChangeRounds((prev) =>
      prev.map((round) =>
        round.id === roundId
          ? {
              ...round,
              results: round.results.map((r) =>
                r.model === modelName ? updater(r) : r
              ),
            }
          : round
      )
    );
  };

  const runSingleModel = async (
    roundId: string,
    modelName: string,
    promptText: string,
    attachedImages: ChatAttachment[],
    systemPrompt: string,
    signal: AbortSignal
  ) => {
    const startedAt = Date.now();
    updateRoundResult(roundId, modelName, (r) => ({
      ...r,
      status: 'streaming',
      startedAt,
    }));

    const userMsg: ChatMessage = {
      id: `cmp-u-${Date.now()}`,
      role: 'user',
      content: promptText,
      images: attachedImages.length > 0 ? attachedImages : undefined,
      createdAt: Date.now(),
    };

    try {
      await streamOllamaChat({
        baseUrl: project.baseUrl,
        model: modelName,
        systemPrompt,
        messages: [userMsg],
        params: {
          ...project.params,
          temperature,
          thinkMode,
          toolsEnabled: false,
        },
        signal,
        onChunk: ({ content, thinking }) => {
          updateRoundResult(roundId, modelName, (r) => ({
            ...r,
            content,
            thinking,
          }));
        },
        onComplete: ({ metrics }) => {
          updateRoundResult(roundId, modelName, (r) => ({
            ...r,
            status: 'done',
            metrics,
            finishedAt: Date.now(),
          }));
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateRoundResult(roundId, modelName, (r) => ({
          ...r,
          status: 'aborted',
          finishedAt: Date.now(),
        }));
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to stream response.';
      updateRoundResult(roundId, modelName, (r) => ({
        ...r,
        status: 'error',
        error: message,
        finishedAt: Date.now(),
      }));
    }
  };

  const handleRunCompare = async () => {
    const trimmed = prompt.trim();
    if ((!trimmed && attachments.length === 0) || effectiveSelected.length === 0 || isRunning) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    const roundId = `cmp-round-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRound: CompareRound = {
      id: roundId,
      prompt: trimmed || '(Image prompt)',
      executionMode,
      includeProjectBrain,
      createdAt: Date.now(),
      results: effectiveSelected.map((model) => ({
        model,
        status: 'queued',
        content: '',
        thinking: '',
      })),
    };

    onChangeRounds((prev) => [newRound, ...prev]);

    const systemPrompt = includeProjectBrain
      ? composeSystemPrompt('', project.skills, {
          projectName: project.name,
          brainPrompt: project.brainPrompt,
          rulesMarkdown: project.rulesMarkdown,
          rulesEnabled: project.rulesEnabled,
          contextItems: project.contextItems,
          envVars: project.envVars,
        })
      : '';

    const runAttachments = [...attachments];

    try {
      if (executionMode === 'parallel') {
        await Promise.all(
          effectiveSelected.map((modelName) =>
            runSingleModel(
              roundId,
              modelName,
              trimmed,
              runAttachments,
              systemPrompt,
              controller.signal
            )
          )
        );
      } else {
        for (const modelName of effectiveSelected) {
          if (controller.signal.aborted) break;
          await runSingleModel(
            roundId,
            modelName,
            trimmed,
            runAttachments,
            systemPrompt,
            controller.signal
          );
        }
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleExportComparisonMarkdown = () => {
    if (rounds.length === 0) return;
    const lines: string[] = [
      `# Local Model Comparison Report`,
      `Workspace Project: ${project.name}`,
      `Exported: ${new Date().toISOString()}`,
      '',
    ];
    for (const round of rounds) {
      lines.push(`## Prompt`, round.prompt, '');
      lines.push(
        `Mode: ${round.executionMode} · Brain Context: ${round.includeProjectBrain ? 'Enabled' : 'Isolated'}`,
        ''
      );
      lines.push(`| Model | Status | Speed | Tokens | Total Time |`);
      lines.push(`| :--- | :--- | ---: | ---: | ---: |`);
      for (const res of round.results) {
        const speed = res.metrics?.tokensPerSecond
          ? `${res.metrics.tokensPerSecond.toFixed(1)} tok/s`
          : '—';
        const toks = res.metrics?.evalCount ?? '—';
        const time = res.metrics?.totalDurationMs
          ? `${(res.metrics.totalDurationMs / 1000).toFixed(2)}s`
          : '—';
        lines.push(`| ${res.model} | ${res.status} | ${speed} | ${toks} | ${time} |`);
      }
      lines.push('');
      for (const res of round.results) {
        lines.push(`### ${res.model}`);
        if (res.error) lines.push(`Error: ${res.error}`, '');
        else lines.push(res.content || '(no output)', '');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `local-models-comparison-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestRound = rounds[0];

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <PersepolisMotif className="h-10 w-12" />
              <AzadiTowerMotif className="h-10 w-12" />
              <IsfahanDomeMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                All Local Models Arena · {project.name}
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Compare All Local Models Side by Side
              </h1>
              <p className="mt-1.5 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Benchmark specs, throughput (<code className="font-mono text-xs">tok/s</code>), latency, reasoning traces, and live responses across every model from Ollama and your imported local files.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenModels}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add / Import Models</span>
            </button>
            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Chat</span>
            </button>
          </div>
        </div>

        {/* Section 01: All Local Models Inventory & Selection Matrix */}
        <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                01. All Local Models Matrix ({allLocalModels.length})
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                Select any combination (or all local models) to compare specs and live outputs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/8 p-1 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12">
                {(
                  [
                    ['all', 'All'],
                    ['ollama', 'Ollama'],
                    ['file', 'Local Files'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModelFilter(key)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      modelFilter === key
                        ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                        : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Filter models..."
                className="h-8 w-40 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
              />

              <button
                type="button"
                onClick={onProbeConnection}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    diagnostic.status === 'checking' ? 'animate-spin' : ''
                  }`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {allLocalModels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#6B1D2F]/22 dark:border-[#F3E7D8]/20 py-8 px-4 text-center space-y-3">
              <p className="text-sm font-medium text-[#3A101B] dark:text-[#F5ECE0]">
                No local models registered or detected yet
              </p>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] max-w-md mx-auto">
                Connect your local Ollama daemon or import any local <code className="font-mono">.gguf</code>, <code className="font-mono">Modelfile</code>, or model tag to start comparing.
              </p>
              <button
                type="button"
                onClick={onOpenModels}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Import from Local Files or Ollama</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                  {effectiveSelected.length} of {allLocalModels.length} models selected for comparison
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedModels(allLocalModels.map((m) => m.name))}
                    className="font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                  >
                    Select All ({allLocalModels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedModels(
                        allLocalModels.filter((m) => m.inOllama).map((m) => m.name)
                      )
                    }
                    className="font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                  >
                    Ollama Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedModels([])}
                    className="text-[#6E4A53] dark:text-[#CEB8AE] hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/65 dark:bg-[#16080D]/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-[#6B1D2F]/5 dark:bg-[#F3E7D8]/5 text-[#4D1422] dark:text-[#E6B8A2]">
                      <th className="w-10 px-3 py-2.5">Use</th>
                      <th className="px-3 py-2.5 font-medium">Model</th>
                      <th className="px-3 py-2.5 font-medium">Source</th>
                      <th className="px-3 py-2.5 font-medium">Family</th>
                      <th className="px-3 py-2.5 font-medium">Params</th>
                      <th className="px-3 py-2.5 font-medium">Quant</th>
                      <th className="px-3 py-2.5 text-right font-medium">Size</th>
                      <th className="px-3 py-2.5 text-right font-medium">Last Speed</th>
                      <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10">
                    {filteredModels.map((m) => {
                      const isChecked = effectiveSelected.includes(m.name);
                      const lastRun = lastMetricsByModel.get(m.name);
                      const showInfo = inspectedModels[m.name];

                      return (
                        <tr
                          key={m.name}
                          className={`transition-colors ${
                            isChecked
                              ? 'bg-[#6B1D2F]/[0.05] dark:bg-[#8C253E]/15'
                              : 'hover:bg-[#6B1D2F]/[0.03] dark:hover:bg-[#F3E7D8]/[0.04]'
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleModelSelection(m.name)}
                              aria-label={`Compare ${m.name}`}
                              className="h-4 w-4 accent-[#6B1D2F] dark:accent-[#E6B8A2] cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#2B0F17] dark:text-[#FAF5EC]">
                            <div>{m.name}</div>
                            {showInfo && (
                              <div className="mt-1 text-[11px] font-normal text-[#6E4A53] dark:text-[#C5AE9F]">
                                {showInfo.details?.families?.join(', ') || showInfo.details?.family || 'Local'}
                                {showInfo.model_info?.['general.context_length']
                                  ? ` · ctx ${String(showInfo.model_info['general.context_length'])}`
                                  : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[#5C3A42] dark:text-[#CEB8AE]">
                            {m.sourceLabel}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#5C3A42] dark:text-[#CEB8AE]">
                            {m.family || showInfo?.details?.family || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-[#5C3A42] dark:text-[#CEB8AE]">
                            {m.parameterSize || showInfo?.details?.parameter_size || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#5C3A42] dark:text-[#CEB8AE]">
                            {m.quantization || showInfo?.details?.quantization_level || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#5C3A42] dark:text-[#CEB8AE]">
                            {formatBytes(m.sizeBytes) || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#4D1422] dark:text-[#E6B8A2]">
                            {lastRun?.metrics?.tokensPerSecond
                              ? `${lastRun.metrics.tokensPerSecond.toFixed(1)} tok/s`
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {m.inOllama && (
                                <button
                                  type="button"
                                  onClick={() => void handleInspectModel(m.name)}
                                  title="Fetch /api/show specs"
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>{inspectingTag === m.name ? '...' : showInfo ? 'Hide' : 'Specs'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenInChat(m.name, '', '')}
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                              >
                                <span>Chat</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Section 02: Prompt & Benchmark Runner */}
        <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                02. Run Side-by-Side Prompt Comparison
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                Send one prompt to {effectiveSelected.length} selected local model(s) using Sequential (VRAM-safe) or Parallel execution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/8 p-1 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12">
                <button
                  type="button"
                  onClick={() => setExecutionMode('sequential')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    executionMode === 'sequential'
                      ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                      : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                  }`}
                >
                  Sequential (VRAM Safe)
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode('parallel')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    executionMode === 'parallel'
                      ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                      : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                  }`}
                >
                  Parallel
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {BENCHMARK_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setPrompt(item.prompt)}
                className="rounded-lg border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/80 dark:bg-[#16080D]/70 px-2.5 py-1 text-xs text-[#4D1422] dark:text-[#E8DAD0] hover:border-[#6B1D2F]/40 dark:hover:border-[#E6B8A2]/40 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-xl overflow-hidden border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/20"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== img.id))
                    }
                    aria-label={`Remove ${img.name}`}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2B0F17]/80 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleRunCompare();
              }
            }}
            placeholder="Enter a prompt to run across your selected local models (Cmd/Ctrl + Enter to compare)..."
            className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#4D1422] dark:text-[#E6B8A2]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleAttachImages(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Attach Image</span>
              </button>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProjectBrain}
                  onChange={(e) => setIncludeProjectBrain(e.target.checked)}
                  className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                />
                <span>Use Project Brain &amp; Rules</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thinkMode}
                  onChange={(e) => setThinkMode(e.target.checked)}
                  className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                />
                <span>Thinking</span>
              </label>

              <label className="flex items-center gap-2">
                <span>Temp</span>
                <input
                  type="number"
                  min={0}
                  max={1.5}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="h-7 w-16 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2 text-xs font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0]"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              {rounds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleExportComparisonMarkdown}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Report</span>
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => onChangeRounds(() => [])}
                    aria-label="Clear comparison history"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#9E1B32] dark:hover:text-[#F899A9] disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {isRunning ? (
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#4D1422] dark:bg-[#9E2A45] px-4 text-xs font-medium text-[#FAF5EC] whitespace-nowrap shrink-0"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop Comparison</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    effectiveSelected.length === 0 ||
                    (!prompt.trim() && attachments.length === 0)
                  }
                  onClick={() => void handleRunCompare()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Compare {effectiveSelected.length} Models</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Section 03: Side-by-Side Results & Metrics Summary */}
        {latestRound ? (
          <div className="space-y-6">
            {rounds.map((round, roundIdx) => {
              const fastestSpeed = round.results.reduce((max, r) => {
                const tps = r.metrics?.tokensPerSecond ?? 0;
                return tps > max ? tps : max;
              }, 0);

              return (
                <section key={round.id} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#6E4A53] dark:text-[#C5AE9F]">
                        {roundIdx === 0 ? 'Latest Comparison' : `Round ${rounds.length - roundIdx}`} ·{' '}
                        {round.executionMode === 'sequential' ? 'Sequential' : 'Parallel'} ·{' '}
                        {new Date(round.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0] line-clamp-2">
                        {round.prompt}
                      </h3>
                    </div>
                  </div>

                  {/* Metrics Comparison Table */}
                  <div className="overflow-x-auto rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#230D14]/70">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 bg-[#6B1D2F]/5 dark:bg-[#F3E7D8]/5 text-[#4D1422] dark:text-[#E6B8A2]">
                          <th className="px-3.5 py-2 font-medium">Model</th>
                          <th className="px-3.5 py-2 font-medium">Status</th>
                          <th className="px-3.5 py-2 text-right font-medium">Speed</th>
                          <th className="px-3.5 py-2 text-right font-medium">Load Time</th>
                          <th className="px-3.5 py-2 text-right font-medium">Total Latency</th>
                          <th className="px-3.5 py-2 text-right font-medium">Prompt / Output Tokens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10 font-mono tabular-nums">
                        {round.results.map((res) => {
                          const isFastest =
                            fastestSpeed > 0 &&
                            res.metrics?.tokensPerSecond === fastestSpeed;
                          return (
                            <tr key={res.model} className="text-[#2B0F17] dark:text-[#F5ECE0]">
                              <td className="px-3.5 py-2 font-semibold">
                                {res.model}
                                {isFastest && (
                                  <span className="ml-2 font-sans text-[11px] font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                                    · Fastest
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2 font-sans text-[#6E4A53] dark:text-[#CEB8AE]">
                                {res.status === 'streaming'
                                  ? 'Streaming...'
                                  : res.status === 'queued'
                                    ? 'Queued'
                                    : res.status === 'done'
                                      ? 'Completed'
                                      : res.status === 'aborted'
                                        ? 'Stopped'
                                        : 'Error'}
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                {res.metrics?.tokensPerSecond
                                  ? `${res.metrics.tokensPerSecond.toFixed(1)} tok/s`
                                  : '—'}
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                {res.metrics?.loadDurationMs !== undefined
                                  ? `${res.metrics.loadDurationMs.toFixed(0)} ms`
                                  : '—'}
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                {res.metrics?.totalDurationMs !== undefined
                                  ? `${(res.metrics.totalDurationMs / 1000).toFixed(2)}s`
                                  : '—'}
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                {res.metrics?.promptEvalCount ?? '—'} /{' '}
                                {res.metrics?.evalCount ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Side-by-Side Response Columns */}
                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      round.results.length >= 3
                        ? 'md:grid-cols-2 xl:grid-cols-3'
                        : round.results.length === 2
                          ? 'md:grid-cols-2'
                          : 'grid-cols-1'
                    }`}
                  >
                    {round.results.map((res) => {
                      const thinkKey = `${round.id}-${res.model}`;
                      const isThinkOpen = expandedThinking[thinkKey] ?? false;
                      const isFastest =
                        fastestSpeed > 0 &&
                        res.metrics?.tokensPerSecond === fastestSpeed;

                      return (
                        <div
                          key={res.model}
                          className="flex flex-col rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#230D14]/70 backdrop-blur-md p-4"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-2.5">
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-semibold text-[#2B0F17] dark:text-[#FAF5EC] truncate">
                                {res.model}
                              </div>
                              <div className="mt-0.5 text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                                {res.status === 'streaming'
                                  ? 'Streaming...'
                                  : res.status === 'queued'
                                    ? 'Waiting in queue'
                                    : res.metrics?.tokensPerSecond
                                      ? `${res.metrics.tokensPerSecond.toFixed(1)} tok/s · ${(
                                          (res.metrics.totalDurationMs || 0) / 1000
                                        ).toFixed(2)}s`
                                      : res.status}
                                {isFastest ? ' · Fastest' : ''}
                              </div>
                            </div>

                            {res.content && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await navigator.clipboard
                                      .writeText(res.content)
                                      .catch(() => {});
                                    setCopiedKey(thinkKey);
                                    window.setTimeout(() => setCopiedKey(null), 1500);
                                  }}
                                  title="Copy response"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 text-[#4D1422] dark:text-[#E6B8A2] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                                >
                                  {copiedKey === thinkKey ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenInChat(res.model, round.prompt, res.content)
                                  }
                                  title="Continue in Chat with this model"
                                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2 text-[11px] font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                                >
                                  <span>Use</span>
                                  <ArrowUpRight className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex-1 min-h-[120px] max-h-[460px] overflow-y-auto space-y-3">
                            {res.thinking && (
                              <div className="rounded-xl border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/75 dark:bg-[#16080D]/75">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedThinking((prev) => ({
                                      ...prev,
                                      [thinkKey]: !prev[thinkKey],
                                    }))
                                  }
                                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-medium text-[#6E4A53] dark:text-[#CEB8AE]"
                                >
                                  <span>Reasoning trace</span>
                                  {isThinkOpen ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                </button>
                                {isThinkOpen && (
                                  <div className="border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-3 py-2 text-[11px] font-mono whitespace-pre-wrap text-[#5C3A42] dark:text-[#DAC6BC]">
                                    {res.thinking}
                                  </div>
                                )}
                              </div>
                            )}

                            {res.error ? (
                              <div className="rounded-xl border border-[#9E1B32]/25 bg-[#9E1B32]/10 p-3 text-xs text-[#7A1326] dark:text-[#FBC2CB]">
                                {res.error}
                              </div>
                            ) : res.content ? (
                              <MarkdownRenderer content={res.content} />
                            ) : res.status === 'queued' ? (
                              <p className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                                Queued to run after previous model finishes...
                              </p>
                            ) : res.status === 'streaming' ? (
                              <p className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                                Loading weights and waiting for first token...
                              </p>
                            ) : (
                              <p className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                                No output produced.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 py-10 px-4 text-center space-y-2">
            <Scale className="h-6 w-6 mx-auto text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <p className="text-sm font-medium text-[#3A101B] dark:text-[#F5ECE0]">
              Select your local models above and run a prompt to see side-by-side results
            </p>
            <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
              Compare response quality, reasoning traces, load latency, and tokens per second across all your local models.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
