import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ImagePlus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type {
  ChatAttachment,
  ChatMessage,
  ConnectionDiagnostic,
  Conversation,
  ImportedModelProfile,
  ModelParameters,
  WorkspaceProject,
} from '../types/ollama';
import { formatBytes } from '../services/ollamaClient';
import { computeContextSnapshot } from '../services/contextMetrics';
import { ContextMonitorModal, ContextMonitorStrip } from './ContextMonitorModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  AzadiTowerMotif,
  IsfahanDomeMotif,
  PersepolisMotif,
  SiOSePolMotif,
} from './PersianMotifs';

interface ChatViewProps {
  project: WorkspaceProject;
  conversation: Conversation;
  baseUrl: string;
  onChangeBaseUrl: (url: string) => void;
  diagnostic: ConnectionDiagnostic;
  onProbeConnection: () => void;
  params: ModelParameters;
  onChangeParams: (next: ModelParameters) => void;
  onChangeModel: (model: string) => void;
  onChangeSystemPrompt: (prompt: string) => void;
  isStreaming: boolean;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onStopStreaming: () => void;
  onRegenerateLast: () => void;
  onOpenIntegrationGuide: () => void;
  onOpenSkills: () => void;
  onOpenProjects: () => void;
  onOpenModels: () => void;
  importedModels: ImportedModelProfile[];
  contextMonitorMode: boolean;
  onToggleContextMonitorMode: () => void;
  onToggleRulesEnabled: (enabled: boolean) => void;
  onToggleContextItem: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onClearChat: () => void;
  composerFocusTick?: number;
  draftText: string;
  onChangeDraft: (convId: string, text: string) => void;
  pendingPrompt?: { id: number; text: string } | null;
  onConsumePendingPrompt?: () => void;
}

const SUGGESTED_MODELS = [
  'gemma4:12b',
  'gemma4:e4b',
  'gemma4:26b',
  'gemma4:31b',
];

const STARTER_PROMPTS = [
  {
    motif: 'azadi' as const,
    place: 'Azadi Tower · Tehran',
    title: 'Test live system tools',
    prompt:
      'Use your connected tools to check the current local date and time, and compute (1240 * 1.15) / 12. Summarize the result concisely.',
  },
  {
    motif: 'persepolis' as const,
    place: 'Persepolis · Shiraz',
    title: 'Streaming NDJSON parser',
    prompt:
      'Write a minimal TypeScript function using fetch and ReadableStream to consume Ollama /api/chat NDJSON streaming responses with AbortController.',
  },
  {
    motif: 'isfahan' as const,
    place: 'Isfahan Dome',
    title: 'Structured JSON extraction',
    prompt:
      'Design a clean JSON schema for customer support ticket triage (priority, category, action items, summary) suitable for Ollama format: "json".',
  },
  {
    motif: 'siosepol' as const,
    place: 'Si-o-se-pol · Isfahan',
    title: 'Express proxy bridge',
    prompt:
      'Show a minimal Express.js POST /api/chat route that forwards streaming chunks from http://localhost:11434/api/chat to a custom web UI.',
  },
];

function renderMotif(motif: 'azadi' | 'persepolis' | 'isfahan' | 'siosepol') {
  const cls = 'h-9 w-12 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85 shrink-0';
  switch (motif) {
    case 'azadi':
      return <AzadiTowerMotif className={cls} />;
    case 'persepolis':
      return <PersepolisMotif className={cls} />;
    case 'isfahan':
      return <IsfahanDomeMotif className={cls} />;
    case 'siosepol':
      return <SiOSePolMotif className={cls} />;
  }
}

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

export function ChatView({
  project,
  conversation,
  baseUrl,
  onChangeBaseUrl,
  diagnostic,
  onProbeConnection,
  params,
  onChangeParams,
  onChangeModel,
  onChangeSystemPrompt,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onRegenerateLast,
  onOpenIntegrationGuide,
  onOpenSkills,
  onOpenProjects,
  onOpenModels,
  importedModels,
  contextMonitorMode,
  onToggleContextMonitorMode,
  onToggleRulesEnabled,
  onToggleContextItem,
  onToggleSkill,
  onClearChat,
  composerFocusTick,
  draftText,
  onChangeDraft,
  pendingPrompt,
  onConsumePendingPrompt,
}: ChatViewProps) {
  const input = draftText;
  const setInput = (next: string | ((prev: string) => string)) => {
    const resolved = typeof next === 'function' ? next(draftText) : next;
    onChangeDraft(conversation.id, resolved);
  };
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showParams, setShowParams] = useState(false);
  const [showContextMonitor, setShowContextMonitor] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  useEffect(() => {
    if (composerFocusTick && composerFocusTick > 0) {
      window.setTimeout(() => textareaRef.current?.focus(), 20);
    }
  }, [composerFocusTick]);

  useEffect(() => {
    if (pendingPrompt?.text) {
      onChangeDraft(conversation.id, pendingPrompt.text);
      onConsumePendingPrompt?.();
      window.setTimeout(() => textareaRef.current?.focus(), 20);
    }
  }, [pendingPrompt, conversation.id, onChangeDraft, onConsumePendingPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const installedNames = diagnostic.models.map((m) => m.name);
  const importedNames = importedModels.map((m) => m.name);
  const modelOptions = Array.from(
    new Set(
      [conversation.model, ...installedNames, ...importedNames, ...SUGGESTED_MODELS].filter(
        Boolean
      )
    )
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const converted = await Promise.all(imageFiles.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...converted]);
  };

  const handleSubmit = () => {
    if (isStreaming) return;
    if (!input.trim() && attachments.length === 0) return;
    onSendMessage(input.trim(), attachments);
    onChangeDraft(conversation.id, '');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === 'Enter') {
        if (showContextMonitor) return;
        const target = e.target as HTMLElement | null;
        const isOtherEditable =
          target &&
          target !== textareaRef.current &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
        if (isOtherEditable) return;
        e.preventDefault();
        handleSubmitRef.current();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [showContextMonitor]);

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      window.setTimeout(() => setCopiedMsgId(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const lastAssistantIdx = (() => {
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const activeSkillsCount = project.skills.filter((s) => s.enabled).length;
  const activeConnectorsCount = project.connectors.filter((c) => c.enabled).length;
  const activeContextCount = project.contextItems.filter((c) => c.enabled).length;
  const activeToolsCount = params.toolsEnabled ? activeConnectorsCount : 0;

  const contextSnapshot = useMemo(
    () => computeContextSnapshot(project, conversation, input),
    [project, conversation, input]
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-transparent"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Minimal Workspace Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="model-select"
              className="text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE] whitespace-nowrap"
            >
              Model
            </label>
            {customModelMode ? (
              <div className="flex items-center gap-1.5">
                <input
                  id="model-select"
                  type="text"
                  value={conversation.model}
                  onChange={(e) => onChangeModel(e.target.value)}
                  placeholder="gemma4:12b"
                  className="h-9 w-40 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#19080E]/85 px-2.5 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCustomModelMode(false)}
                  className="h-9 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/75 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B] whitespace-nowrap shrink-0"
                >
                  List
                </button>
              </div>
            ) : (
              <select
                id="model-select"
                value={conversation.model}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomModelMode(true);
                  } else if (e.target.value === '__import__') {
                    onOpenModels();
                  } else {
                    onChangeModel(e.target.value);
                  }
                }}
                className="h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#19080E]/85 px-2.5 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
              >
                {modelOptions.map((name) => {
                  const matched = diagnostic.models.find((m) => m.name === name);
                  const customProf = importedModels.find((m) => m.name === name);
                  const suffix = matched
                    ? ` (${formatBytes(matched.size)})`
                    : customProf
                      ? ` (${customProf.sourceType})`
                      : installedNames.length > 0
                        ? ' (not pulled)'
                        : '';
                  return (
                    <option key={name} value={name}>
                      {name}
                      {suffix}
                    </option>
                  );
                })}
                <option value="__import__">+ Import / pull model...</option>
                <option value="__custom__">Custom tag...</option>
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowParams(true)}
            className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#4D1422] dark:hover:text-[#F5ECE0] transition-colors whitespace-nowrap"
          >
            {diagnostic.status === 'connected' && (
              <span className="text-[#4D1422] dark:text-[#E6B8A2] font-medium">
                Connected ({diagnostic.models.length})
              </span>
            )}
            {diagnostic.status === 'checking' && <span>Checking...</span>}
            {diagnostic.status === 'error' && (
              <span className="text-[#8F243C] dark:text-[#F099A8] font-medium">
                Offline (Check endpoint)
              </span>
            )}
            {diagnostic.status === 'idle' && <span>Ready</span>}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenProjects}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0 tabular-nums"
          >
            <Brain className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <span>
              {project.name} · {activeContextCount} files{project.rulesEnabled && project.rulesMarkdown.trim() ? ' · rules.md' : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSkills}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0 tabular-nums"
          >
            <Wrench className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <span>
              {activeSkillsCount} skills · {activeToolsCount} tools
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowContextMonitor(true)}
            aria-expanded={showContextMonitor}
            title="Open Context Monitor pop-up"
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              contextSnapshot.status === 'critical'
                ? 'border-[#9E1B32]/40 bg-[#9E1B32]/12 dark:bg-[#9E1B32]/25 text-[#7A1326] dark:text-[#FBC2CB]'
                : contextSnapshot.status === 'elevated'
                  ? 'border-[#B45309]/40 bg-[#B45309]/10 dark:bg-[#B45309]/20 text-[#7C3507] dark:text-[#FDE68A]'
                  : contextMonitorMode
                    ? 'border-[#6B1D2F]/35 bg-[#6B1D2F]/10 dark:bg-[#8C253E]/30 text-[#4D1422] dark:text-[#FAF5EC]'
                    : 'border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/75 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <span>
              Context {contextSnapshot.utilizationPct}%
              {contextSnapshot.status !== 'healthy' ? ` · ${contextSnapshot.statusLabel}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowParams((v) => !v)}
            aria-expanded={showParams}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showParams
                ? 'border-[#6B1D2F]/40 bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                : 'border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/70 dark:bg-[#230D14]/75 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Live Context Monitoring Mode Strip */}
      {contextMonitorMode && (
        <ContextMonitorStrip
          snapshot={contextSnapshot}
          onOpenModal={() => setShowContextMonitor(true)}
          onDisableMonitorMode={onToggleContextMonitorMode}
        />
      )}

      {/* Expandable Glass Settings, Endpoint & Thread System Prompt Drawer */}
      {showParams && (
        <div className="border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 bg-[#FAF5EC]/65 dark:bg-[#1E0A11]/75 backdrop-blur-md px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="endpoint-input"
                  className="text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE] whitespace-nowrap"
                >
                  Project Endpoint
                </label>
                <input
                  id="endpoint-input"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => onChangeBaseUrl(e.target.value)}
                  onBlur={onProbeConnection}
                  placeholder="http://localhost:11434"
                  className="h-8 w-56 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onProbeConnection}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${
                      diagnostic.status === 'checking' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Test</span>
                </button>
              </div>
              {diagnostic.status === 'error' && (
                <button
                  type="button"
                  onClick={onOpenIntegrationGuide}
                  className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline whitespace-nowrap"
                >
                  Setup &amp; CORS Guide
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <label
                  htmlFor="system-prompt"
                  className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5"
                >
                  Thread Instructions (layered on top of {project.name} brain &amp; context)
                </label>
                <textarea
                  id="system-prompt"
                  rows={3}
                  value={conversation.systemPrompt}
                  onChange={(e) => onChangeSystemPrompt(e.target.value)}
                  placeholder="Optional thread-specific instructions for this chat..."
                  className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-3 py-2 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                />
              </div>

              <div className="md:col-span-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="param-temp"
                    className="flex items-center justify-between text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5"
                  >
                    <span>Temp</span>
                    <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#CEB8AE]">
                      {params.temperature.toFixed(2)}
                    </span>
                  </label>
                  <input
                    id="param-temp"
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={params.temperature}
                    onChange={(e) =>
                      onChangeParams({ ...params, temperature: Number(e.target.value) })
                    }
                    className="w-full accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="param-top-p"
                    className="flex items-center justify-between text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5"
                  >
                    <span>Top-P</span>
                    <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#CEB8AE]">
                      {params.topP.toFixed(2)}
                    </span>
                  </label>
                  <input
                    id="param-top-p"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={params.topP}
                    onChange={(e) =>
                      onChangeParams({ ...params, topP: Number(e.target.value) })
                    }
                    className="w-full accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="param-ctx"
                    className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5"
                  >
                    Context (num_ctx)
                  </label>
                  <select
                    id="param-ctx"
                    value={params.numCtx}
                    onChange={(e) =>
                      onChangeParams({ ...params, numCtx: Number(e.target.value) })
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2 text-xs font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  >
                    <option value={4096}>4,096</option>
                    <option value={8192}>8,192</option>
                    <option value={16384}>16,384</option>
                    <option value={32768}>32,768</option>
                    <option value={65536}>65,536</option>
                    <option value={131072}>131,072</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="param-keepalive"
                    className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5"
                  >
                    Keep Alive
                  </label>
                  <select
                    id="param-keepalive"
                    value={params.keepAlive}
                    onChange={(e) =>
                      onChangeParams({ ...params, keepAlive: e.target.value })
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="60m">60m</option>
                    <option value="-1">Stay (-1)</option>
                    <option value="0">Unload (0)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 pt-3 text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.thinkMode}
                    onChange={(e) =>
                      onChangeParams({ ...params, thinkMode: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-[#6B1D2F]/30 accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                  />
                  <span>Thinking</span>
                </label>

                <label className="flex items-center gap-2 pt-3 text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.jsonMode}
                    onChange={(e) =>
                      onChangeParams({ ...params, jsonMode: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-[#6B1D2F]/30 accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                  />
                  <span>JSON</span>
                </label>

                <label className="flex items-center gap-2 pt-3 text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.toolsEnabled}
                    onChange={(e) =>
                      onChangeParams({ ...params, toolsEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-[#6B1D2F]/30 accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                  />
                  <span>Tools</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {conversation.messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col justify-center py-8">
            {/* Minimal Persian Architectural Strip */}
            <div className="mb-6 flex items-center gap-5 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-5 text-[#6B1D2F] dark:text-[#E6B8A2]">
              <div className="flex items-center gap-4">
                <PersepolisMotif className="h-10 w-14 opacity-85" />
                <AzadiTowerMotif className="h-10 w-14 opacity-85" />
                <IsfahanDomeMotif className="h-10 w-14 opacity-85" />
                <SiOSePolMotif className="h-10 w-14 opacity-85" />
              </div>
            </div>

            <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
              Isolated Workspace · {project.name}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
              Local {conversation.model}
            </h1>
            <p className="mt-2 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-xl leading-relaxed">
              Direct streaming from{' '}
              <code className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 text-[#4D1422] dark:text-[#E6B8A2]">
                {baseUrl}/api/chat
              </code>{' '}
              with isolated project brain, context vault, skills, and connectors.
            </p>

            {diagnostic.status === 'error' && (
              <div className="mt-6 rounded-2xl border border-[#6B1D2F]/25 dark:border-[#E6B8A2]/25 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 backdrop-blur-md p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      {diagnostic.errorTitle || 'Ollama endpoint unreachable'}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#5C3A42] dark:text-[#CEB8AE]">
                      {diagnostic.errorDetail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={onOpenIntegrationGuide}
                        className="inline-flex h-9 items-center rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
                      >
                        Integration &amp; CORS Guide
                      </button>
                      <button
                        type="button"
                        onClick={onProbeConnection}
                        className="inline-flex h-9 items-center rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-3.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                  className="group rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md p-4 text-left hover:border-[#6B1D2F]/35 dark:hover:border-[#E6B8A2]/35 hover:bg-[#FCF8F2]/90 dark:hover:bg-[#2E111B]/85 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F] truncate">
                        {item.place}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0] group-hover:text-[#6B1D2F] dark:group-hover:text-[#E6B8A2]">
                        {item.title}
                      </div>
                    </div>
                    {renderMotif(item.motif)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {conversation.messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isTool = msg.role === 'tool';
              const isLastAssistant = idx === lastAssistantIdx;
              const hasThinking = Boolean(msg.thinking && msg.thinking.trim().length > 0);
              const isThinkingOpen =
                expandedThinking[msg.id] ?? (isStreaming && isLastAssistant && !msg.content);
              const isToolExpanded = expandedTools[msg.id] ?? false;

              if (isTool) {
                return (
                  <div key={msg.id} className="w-full">
                    <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTools((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-xs text-[#4D1422] dark:text-[#E6B8A2] hover:text-[#2B0F17] dark:hover:text-[#FAF5EC]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Wrench className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0" />
                          <span className="font-mono font-medium truncate">
                            {msg.toolName || 'system_connector'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#6B1D2F] dark:text-[#E6B8A2] font-medium">
                            {msg.toolSuccess === false ? 'Error' : 'Executed'}
                          </span>
                          {msg.toolDurationMs !== undefined && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                                {msg.toolDurationMs.toFixed(0)}ms
                              </span>
                            </>
                          )}
                        </div>
                        {isToolExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                      </button>
                      {isToolExpanded && (
                        <pre className="border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-3.5 py-2.5 text-xs font-mono text-[#3A101B] dark:text-[#F5ECE0] overflow-x-auto whitespace-pre-wrap">
                          {msg.content}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={isUser ? 'flex justify-end' : 'flex justify-start'}
                >
                  {isUser ? (
                    <div className="max-w-[85%] rounded-2xl border border-[#541524]/20 dark:border-[#E6B8A2]/20 bg-[#6B1D2F]/92 dark:bg-[#7B2036]/92 backdrop-blur-md px-4 py-3 text-[#FAF5EC] shadow-xs">
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {msg.images.map((img) => (
                            <img
                              key={img.id}
                              src={img.dataUrl}
                              alt={img.name}
                              referrerPolicy="no-referrer"
                              className="h-24 w-24 rounded-lg object-cover border border-[#FAF5EC]/25"
                            />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  ) : (
                    <div className="w-full min-w-0">
                      <div className="mb-1.5 flex items-center gap-2 text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                        <span className="font-mono font-medium text-[#4D1422] dark:text-[#E6B8A2]">
                          {conversation.model}
                        </span>
                        {isStreaming && isLastAssistant && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Streaming</span>
                          </>
                        )}
                      </div>

                      {hasThinking && (
                        <div className="mb-3 rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md">
                          <button
                            type="button"
                            onClick={() => toggleThinking(msg.id)}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                          >
                            <span>Reasoning trace</span>
                            {isThinkingOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {isThinkingOpen && (
                            <div className="border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-3.5 py-2.5 text-xs leading-relaxed text-[#5C3A42] dark:text-[#DAC6BC] whitespace-pre-wrap font-mono">
                              {msg.thinking}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {msg.toolCalls.map((tc, tcIdx) => (
                            <div
                              key={`${msg.id}-tc-${tcIdx}`}
                              className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md px-3.5 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 text-[#4D1422] dark:text-[#E6B8A2]">
                                <Wrench className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                                <span className="font-medium">Tool call:</span>
                                <code className="font-mono font-semibold">{tc.function.name}</code>
                              </div>
                              <pre className="mt-1.5 overflow-x-auto text-[11px] font-mono text-[#6E4A53] dark:text-[#CEB8AE]">
                                {JSON.stringify(tc.function.arguments, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.error ? (
                        <div className="rounded-2xl border border-[#6B1D2F]/25 dark:border-[#E6B8A2]/25 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 p-3.5">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed text-[#3A101B] dark:text-[#F5ECE0]">
                              <p className="font-semibold">Request failed: {msg.error}</p>
                              <p className="mt-1 text-[#5C3A42] dark:text-[#CEB8AE]">
                                Check that Ollama is running, <code className="font-mono">{conversation.model}</code> is pulled, and <code className="font-mono">OLLAMA_ORIGINS</code> allows this origin.
                              </p>
                              <div className="mt-2.5 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={onRegenerateLast}
                                  className="rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 py-1 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                                >
                                  Retry
                                </button>
                                <button
                                  type="button"
                                  onClick={onOpenIntegrationGuide}
                                  className="rounded-lg border border-[#6B1D2F]/25 dark:border-[#F3E7D8]/20 px-2.5 py-1 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]"
                                >
                                  Setup Guide
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : msg.toolCalls && msg.toolCalls.length > 0 ? null : (
                        <div className="text-sm text-[#6E4A53] dark:text-[#CEB8AE]">
                          Waiting for first token...
                        </div>
                      )}

                      {!msg.error && msg.content && (!isStreaming || !isLastAssistant) && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-2 text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                          <div className="flex items-center gap-2 font-mono tabular-nums">
                            {msg.metrics?.tokensPerSecond !== undefined && (
                              <span>{msg.metrics.tokensPerSecond.toFixed(1)} tok/s</span>
                            )}
                            {msg.metrics?.evalCount !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{msg.metrics.evalCount} tokens</span>
                              </>
                            )}
                            {msg.metrics?.totalDurationMs !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{(msg.metrics.totalDurationMs / 1000).toFixed(2)}s</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC] transition-colors"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {isLastAssistant && !isStreaming && (
                              <button
                                type="button"
                                onClick={onRegenerateLast}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC] transition-colors"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Regenerate</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Frosted Glass Composer */}
      <div className="px-4 pb-4 pt-2 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div
            className={`rounded-2xl border backdrop-blur-xl transition-colors shadow-[0_8px_30px_rgba(107,29,47,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
              isDragging
                ? 'border-[#6B1D2F] dark:border-[#E6B8A2] bg-[#FAF5EC]/90 dark:bg-[#290F18]/90'
                : 'border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#210C13]/85 focus-within:border-[#6B1D2F]/55 dark:focus-within:border-[#E6B8A2]/55'
            }`}
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-3 py-2.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/18 overflow-hidden"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                      }
                      aria-label={`Remove ${att.name}`}
                      className="absolute right-1 top-1 rounded bg-[#2B0F17]/80 p-0.5 text-[#FAF5EC] hover:bg-[#2B0F17]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  (e.key === 'Enter' && !e.shiftKey) ||
                  ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === 'Enter')
                ) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Message ${conversation.model} inside ${project.name}...`}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] text-[#2B0F17] dark:text-[#F5ECE0] placeholder:text-[#8E6B73] dark:placeholder:text-[#A98F95] focus:outline-none"
            />

            <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
              <div className="relative flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC] transition-colors whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Image</span>
                </button>

                {project.prompts.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPromptPicker((v) => !v)}
                      aria-expanded={showPromptPicker}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Prompts ({project.prompts.length})</span>
                    </button>

                    {showPromptPicker && (
                      <div className="absolute bottom-10 left-0 z-30 w-72 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#260E16] p-1.5 shadow-lg space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-[#6E4A53] dark:text-[#C5AE9F]">
                          <span>{project.name} Prompts</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPromptPicker(false);
                              onOpenProjects();
                            }}
                            className="text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                          >
                            Manage
                          </button>
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {project.prompts.map((p) => {
                            const isSys = p.kind === 'system';
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  if (isSys) {
                                    onChangeSystemPrompt(p.content);
                                  } else {
                                    setInput((prev) =>
                                      prev.trim() ? `${prev.trim()}\n\n${p.content}` : p.content
                                    );
                                    window.setTimeout(() => textareaRef.current?.focus(), 20);
                                  }
                                  setShowPromptPicker(false);
                                }}
                                className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/8 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[#3A101B] dark:text-[#F5ECE0] truncate">
                                    {p.title}
                                  </span>
                                  <span className="text-[10px] text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0">
                                    {isSys ? 'System' : 'Query'}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-[#6E4A53] dark:text-[#CEB8AE] line-clamp-2">
                                  {p.content}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {attachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachments([])}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear images</span>
                  </button>
                )}

                {conversation.messages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChat}
                    title={`Clear chat (${modKey}K)`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear chat</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-[11px] font-mono tabular-nums text-[#8E6B73] dark:text-[#B49A9F] whitespace-nowrap">
                  {modKey}Enter send · {modKey}K clear · {modKey}N new
                </span>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopStreaming}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#4D1422] dark:bg-[#9E2A45] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#3A101B] dark:hover:bg-[#B23350] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!input.trim() && attachments.length === 0}
                    title={`Send message (${modKey}Enter)`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Send</span>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContextMonitorModal
        open={showContextMonitor}
        onClose={() => setShowContextMonitor(false)}
        project={project}
        model={conversation.model}
        params={params}
        snapshot={contextSnapshot}
        monitorModeEnabled={contextMonitorMode}
        onToggleMonitorMode={onToggleContextMonitorMode}
        onChangeNumCtx={(numCtx) => onChangeParams({ ...params, numCtx })}
        onToggleRulesEnabled={onToggleRulesEnabled}
        onToggleToolsEnabled={(toolsEnabled) =>
          onChangeParams({ ...params, toolsEnabled })
        }
        onToggleContextItem={onToggleContextItem}
        onToggleSkill={onToggleSkill}
      />
    </div>
  );
}
