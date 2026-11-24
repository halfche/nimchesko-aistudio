import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cpu,
  Database,
  Download,
  Eye,
  FileCode2,
  FileUp,
  FolderSync,
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ConnectionDiagnostic,
  Conversation,
  ImportedModelProfile,
  OllamaShowResponse,
  WorkspaceProject,
  WorkspaceSyncBundle,
} from '../types/ollama';
import {
  createOllamaModel,
  deleteOllamaModel,
  formatBytes,
  parseModelfileText,
  pullOllamaModel,
  showOllamaModel,
  type PullOrCreateProgress,
} from '../services/ollamaClient';
import {
  buildWorkspaceSyncBundle,
  mergeWorkspaceSyncBundle,
  parseImportedChatFiles,
} from '../services/workspaceSync';
import { IsfahanDomeMotif, PersepolisMotif } from './PersianMotifs';

interface ModelsAndSyncViewProps {
  projects: WorkspaceProject[];
  activeProject: WorkspaceProject;
  activeConversation?: Conversation;
  importedModels: ImportedModelProfile[];
  drafts: Record<string, string>;
  diagnostic: ConnectionDiagnostic;
  linkedSyncFileName: string | null;
  lastSyncedAt: number | null;
  onProbeConnection: () => void;
  onAddOrUpdateImportedModel: (profile: ImportedModelProfile) => void;
  onDeleteImportedModel: (id: string) => void;
  onSwitchChatModel: (modelName: string) => void;
  onSetProjectDefaultModel: (modelName: string) => void;
  onSyncProjectChatsToModel: (convIds: string[], targetModel: string) => void;
  onImportConversationsToActiveProject: (convs: Conversation[]) => void;
  onApplyMergedWorkspace: (merged: {
    projects: WorkspaceProject[];
    importedModels: ImportedModelProfile[];
    drafts: Record<string, string>;
  }) => void;
  onLinkLocalSyncFile: () => Promise<void>;
  onPullFromLinkedSyncFile: () => Promise<string | null>;
  onUnlinkSyncFile: () => void;
  onBackToChat: () => void;
}

const POPULAR_OLLAMA_TAGS = [
  'gemma4:12b',
  'gemma4:e4b',
  'gemma4:26b',
  'qwen3:8b',
  'llama3.3:latest',
  'deepseek-r1:14b',
];

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ModelsAndSyncView({
  projects,
  activeProject,
  activeConversation,
  importedModels,
  drafts,
  diagnostic,
  linkedSyncFileName,
  lastSyncedAt,
  onProbeConnection,
  onAddOrUpdateImportedModel,
  onDeleteImportedModel,
  onSwitchChatModel,
  onSetProjectDefaultModel,
  onSyncProjectChatsToModel,
  onImportConversationsToActiveProject,
  onApplyMergedWorkspace,
  onLinkLocalSyncFile,
  onPullFromLinkedSyncFile,
  onUnlinkSyncFile,
  onBackToChat,
}: ModelsAndSyncViewProps) {
  const [section, setSection] = useState<'models' | 'sync'>('models');

  // Pull from Ollama state
  const [pullTag, setPullTag] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullOrCreateProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const pullAbortRef = useRef<AbortController | null>(null);

  // File / Modelfile / GGUF import state
  const [importSourceType, setImportSourceType] = useState<'modelfile' | 'gguf'>('modelfile');
  const [customTag, setCustomTag] = useState('');
  const [baseOrPath, setBaseOrPath] = useState('gemma4:12b');
  const [modelfileText, setModelfileText] = useState(
    'FROM gemma4:12b\nPARAMETER temperature 0.6\nPARAMETER num_ctx 16384\nSYSTEM """You are a precise local engineering assistant."""'
  );
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSize, setSelectedFileSize] = useState<number | undefined>(undefined);
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [createProgress, setCreateProgress] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  // Inspect modal / drawer state
  const [inspectingModel, setInspectingModel] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<OllamaShowResponse | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);

  // Chat Sync & Importer state
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importTargetModel, setImportTargetModel] = useState(
    activeConversation?.model || activeProject.defaultModel || 'gemma4:12b'
  );
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [batchTargetModel, setBatchTargetModel] = useState(
    activeConversation?.model || activeProject.defaultModel || 'gemma4:12b'
  );
  const syncFileInputRef = useRef<HTMLInputElement>(null);

  const supportsFileSystemSync =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  const allAvailableModelNames = Array.from(
    new Set([
      ...diagnostic.models.map((m) => m.name),
      ...importedModels.map((m) => m.name),
      activeProject.defaultModel,
    ])
  ).filter(Boolean);

  const handlePullModel = async (tagToPull?: string) => {
    const target = (tagToPull ?? pullTag).trim();
    if (!target || isPulling) return;

    pullAbortRef.current?.abort();
    const controller = new AbortController();
    pullAbortRef.current = controller;

    setIsPulling(true);
    setPullError(null);
    setPullSuccess(null);
    setPullProgress({ status: `Connecting to Ollama for ${target}...` });

    try {
      await pullOllamaModel(
        activeProject.baseUrl,
        target,
        (prog) => setPullProgress(prog),
        controller.signal
      );

      onAddOrUpdateImportedModel({
        id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: target,
        sourceType: 'ollama',
        syncedWithOllama: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setPullSuccess(`Pulled "${target}" into local Ollama.`);
      setPullTag('');
      onProbeConnection();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPullError('Download cancelled.');
      } else {
        setPullError(err instanceof Error ? err.message : 'Failed to pull model.');
      }
    } finally {
      setIsPulling(false);
    }
  };

  const handleModelFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setCreateError(null);

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.gguf') || lower.endsWith('.bin') || lower.endsWith('.safetensors')) {
      setImportSourceType('gguf');
      const cleanStem = file.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!customTag.trim()) {
        setCustomTag(cleanStem || 'local-gguf-model');
      }
      const guessedPath = `./${file.name}`;
      setBaseOrPath(guessedPath);
      setModelfileText(
        `FROM ${guessedPath}\nPARAMETER temperature 0.7\nPARAMETER num_ctx 16384\nSYSTEM """You are a helpful local assistant."""`
      );
    } else {
      setImportSourceType('modelfile');
      const text = await file.text();
      setModelfileText(text);
      const parsed = parseModelfileText(text);
      if (parsed.from) {
        setBaseOrPath(parsed.from);
      }
      if (!customTag.trim()) {
        const cleanStem = file.name
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '-');
        setCustomTag(cleanStem && cleanStem !== 'modelfile' ? cleanStem : 'custom-gemma4');
      }
    }
  };

  const handleSaveModelProfileOnly = () => {
    const name = customTag.trim();
    if (!name) {
      setCreateError('Enter a model tag name first (e.g. gemma4-architect:latest).');
      return;
    }
    const parsed = parseModelfileText(modelfileText);
    const numCtxVal =
      typeof parsed.parameters.num_ctx === 'number'
        ? parsed.parameters.num_ctx
        : undefined;

    onAddOrUpdateImportedModel({
      id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      sourceType: importSourceType,
      baseModel: baseOrPath.trim() || parsed.from,
      fileName: selectedFileName || undefined,
      fileSizeBytes: selectedFileSize,
      modelfileContent: modelfileText,
      systemPrompt: parsed.system,
      recommendedNumCtx: numCtxVal,
      syncedWithOllama: diagnostic.models.some((m) => m.name === name),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setCreateProgress(`Saved "${name}" to your workspace model registry.`);
    setCreateError(null);
  };

  const handleCreateInOllama = async () => {
    const name = customTag.trim();
    if (!name) {
      setCreateError('Enter a model tag name to register in Ollama.');
      return;
    }

    setIsCreatingModel(true);
    setCreateError(null);
    setCreateProgress(`Registering "${name}" in Ollama...`);

    const parsed = parseModelfileText(modelfileText);
    const numCtxVal =
      typeof parsed.parameters.num_ctx === 'number'
        ? parsed.parameters.num_ctx
        : undefined;

    try {
      await createOllamaModel(
        activeProject.baseUrl,
        {
          model: name,
          from: baseOrPath.trim() || parsed.from,
          modelfile: modelfileText,
        },
        (prog) => setCreateProgress(prog.status)
      );

      onAddOrUpdateImportedModel({
        id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        sourceType: importSourceType,
        baseModel: baseOrPath.trim() || parsed.from,
        fileName: selectedFileName || undefined,
        fileSizeBytes: selectedFileSize,
        modelfileContent: modelfileText,
        systemPrompt: parsed.system,
        recommendedNumCtx: numCtxVal,
        syncedWithOllama: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setCreateProgress(`Created "${name}" in local Ollama and synced with workspace.`);
      onProbeConnection();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create model in Ollama.'
      );
      setCreateProgress(null);
    } finally {
      setIsCreatingModel(false);
    }
  };

  const handleInspectModel = async (name: string) => {
    setInspectingModel(name);
    setInspectData(null);
    setInspectError(null);
    setIsInspectLoading(true);
    try {
      const info = await showOllamaModel(activeProject.baseUrl, name);
      setInspectData(info);
    } catch (err) {
      setInspectError(
        err instanceof Error ? err.message : `Could not inspect ${name}`
      );
    } finally {
      setIsInspectLoading(false);
    }
  };

  const handleDeleteFromOllama = async (name: string) => {
    try {
      await deleteOllamaModel(activeProject.baseUrl, name);
      onProbeConnection();
      const matchingProfile = importedModels.find((m) => m.name === name);
      if (matchingProfile) {
        onDeleteImportedModel(matchingProfile.id);
      }
      if (inspectingModel === name) {
        setInspectingModel(null);
      }
    } catch (err) {
      setPullError(
        err instanceof Error ? err.message : `Failed to delete ${name}`
      );
    }
  };

  const handleImportChatOrSyncFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSyncNotice(null);
    setSyncError(null);

    try {
      let mergedCount = 0;
      let importedConvCount = 0;
      let latestProjects = projects;
      let latestModels = importedModels;
      let latestDrafts = drafts;

      for (const file of Array.from(files)) {
        const text = await file.text();
        const parsed = parseImportedChatFiles(file.name, text, importTargetModel);

        if (parsed.type === 'workspace-bundle' && parsed.bundle) {
          const result = mergeWorkspaceSyncBundle(
            latestProjects,
            latestModels,
            latestDrafts,
            parsed.bundle
          );
          latestProjects = result.projects;
          latestModels = result.importedModels;
          latestDrafts = result.drafts;
          mergedCount +=
            result.stats.projectsAdded +
            result.stats.chatsAdded +
            result.stats.chatsUpdated +
            result.stats.modelsAdded;
        } else if (parsed.conversations && parsed.conversations.length > 0) {
          onImportConversationsToActiveProject(parsed.conversations);
          importedConvCount += parsed.conversations.length;
        }
      }

      if (mergedCount > 0 || latestProjects !== projects) {
        onApplyMergedWorkspace({
          projects: latestProjects,
          importedModels: latestModels,
          drafts: latestDrafts,
        });
      }

      const summaryParts: string[] = [];
      if (mergedCount > 0) {
        summaryParts.push(`Merged workspace sync bundle (${mergedCount} updates)`);
      }
      if (importedConvCount > 0) {
        summaryParts.push(
          `Imported ${importedConvCount} chat thread(s) into "${activeProject.name}" bound to ${importTargetModel}`
        );
      }
      setSyncNotice(
        summaryParts.join(' · ') || 'Files processed with no new changes.'
      );
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Could not import selected file.'
      );
    }
  };

  const handleExportFullBackup = () => {
    const bundle: WorkspaceSyncBundle = buildWorkspaceSyncBundle(
      projects,
      importedModels,
      drafts
    );
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadJsonFile(`nimchesko-ai-studio-sync-${dateStamp}.json`, bundle);
    setSyncNotice('Exported full workspace & chat sync bundle (.json).');
    setSyncError(null);
  };

  const pullPct =
    pullProgress?.total && pullProgress?.completed
      ? Math.min(100, Math.round((pullProgress.completed / pullProgress.total) * 100))
      : null;

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <PersepolisMotif className="h-10 w-12" />
              <IsfahanDomeMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                Local Models &amp; Data Sync · {activeProject.name}
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Import Local Models &amp; Sync Chat Data
              </h1>
              <p className="mt-1.5 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Pull models from Ollama, import custom <code className="font-mono text-xs">Modelfile</code> or <code className="font-mono text-xs">.gguf</code> definitions, import chat histories, and sync your workspace across Windows and Linux.
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

        {/* Sub-navigation */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/8 p-1 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12">
          <button
            type="button"
            onClick={() => setSection('models')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              section === 'models'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Local Models ({allAvailableModelNames.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('sync')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              section === 'sync'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            <FolderSync className="h-3.5 w-3.5" />
            <span>Chat Sync &amp; Import</span>
          </button>
        </div>

        {section === 'models' ? (
          <div className="space-y-6">
            {/* Pull from Ollama + Import Modelfile/GGUF Grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Card 1: Pull from Local Ollama Registry */}
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      01. Pull Model via Ollama
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                      Streams <code className="font-mono">POST {activeProject.baseUrl}/api/pull</code> to download local weights.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onProbeConnection}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        diagnostic.status === 'checking' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pullTag}
                    onChange={(e) => setPullTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handlePullModel();
                    }}
                    placeholder="e.g. gemma4:12b, qwen3:8b, llama3.3..."
                    className="h-9 flex-1 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                  {isPulling ? (
                    <button
                      type="button"
                      onClick={() => pullAbortRef.current?.abort()}
                      className="h-9 rounded-xl bg-[#4D1422] dark:bg-[#9E2A45] px-3.5 text-xs font-medium text-[#FAF5EC] whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handlePullModel()}
                      disabled={!pullTag.trim()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Pull</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_OLLAMA_TAGS.map((tag) => {
                    const installed = diagnostic.models.some((m) => m.name === tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={isPulling}
                        onClick={() => void handlePullModel(tag)}
                        className="rounded-lg border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/75 dark:bg-[#16080D]/60 px-2.5 py-1 text-[11px] font-mono text-[#4D1422] dark:text-[#E8DAD0] hover:border-[#6B1D2F]/40 dark:hover:border-[#E6B8A2]/40 transition-colors"
                      >
                        {tag} {installed ? '· Installed' : ''}
                      </button>
                    );
                  })}
                </div>

                {pullProgress && (
                  <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/80 dark:bg-[#16080D]/75 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#3A101B] dark:text-[#F5ECE0] truncate">
                        {pullProgress.status}
                      </span>
                      {pullPct !== null && (
                        <span className="font-mono tabular-nums text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0">
                          {pullPct}%
                        </span>
                      )}
                    </div>
                    {pullPct !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#6B1D2F]/12 dark:bg-[#F3E7D8]/12">
                        <div
                          className="h-full bg-[#6B1D2F] dark:bg-[#E6B8A2] transition-all"
                          style={{ width: `${pullPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {pullError && (
                  <p className="text-xs text-[#9E1B32] dark:text-[#F899A9]">
                    {pullError}
                  </p>
                )}
                {pullSuccess && (
                  <p className="text-xs text-[#4D1422] dark:text-[#E6B8A2] font-medium">
                    {pullSuccess}
                  </p>
                )}
              </div>

              {/* Card 2: Import Model from Local File (Modelfile / .gguf) */}
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      02. Import Model File (.gguf / Modelfile)
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                      Load a local <code className="font-mono">Modelfile</code> or <code className="font-mono">.gguf</code> weight reference and create it in Ollama.
                    </p>
                  </div>
                  <input
                    ref={modelFileInputRef}
                    type="file"
                    accept=".gguf,.modelfile,.txt,.bin,.safetensors,*"
                    className="hidden"
                    onChange={(e) => {
                      void handleModelFileSelected(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => modelFileInputRef.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#16080D]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap shrink-0"
                  >
                    <FileUp className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    <span>Select File</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Target Model Tag
                    </label>
                    <input
                      type="text"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="e.g. gemma4-local:latest"
                      className="h-8 w-full rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      FROM Base Tag or Local .gguf Path
                    </label>
                    <input
                      type="text"
                      value={baseOrPath}
                      onChange={(e) => setBaseOrPath(e.target.value)}
                      placeholder="gemma4:12b or /models/model.gguf"
                      className="h-8 w-full rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                    />
                  </div>
                </div>

                {selectedFileName && (
                  <div className="text-[11px] font-mono text-[#6E4A53] dark:text-[#C5AE9F]">
                    Loaded file: {selectedFileName}
                    {selectedFileSize ? ` (${formatBytes(selectedFileSize) || `${selectedFileSize} B`})` : ''}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Modelfile Definition
                  </label>
                  <textarea
                    rows={4}
                    value={modelfileText}
                    onChange={(e) => setModelfileText(e.target.value)}
                    className="w-full rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-3 py-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveModelProfileOnly}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Save Profile</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingModel}
                    onClick={() => void handleCreateInOllama()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-45"
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span>
                      {isCreatingModel ? 'Creating...' : 'Create in Ollama'}
                    </span>
                  </button>
                </div>

                {createProgress && (
                  <p className="text-xs font-mono text-[#4D1422] dark:text-[#E6B8A2]">
                    {createProgress}
                  </p>
                )}
                {createError && (
                  <p className="text-xs text-[#9E1B32] dark:text-[#F899A9]">
                    {createError}
                  </p>
                )}
              </div>
            </div>

            {/* Installed Ollama Models + Custom Workspace Profiles */}
            <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    03. Available Local Models &amp; Imported Profiles
                  </h2>
                  <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                    Active chat uses <code className="font-mono">{activeConversation?.model || activeProject.defaultModel}</code> · Project default is <code className="font-mono">{activeProject.defaultModel}</code>
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                  {diagnostic.models.length} in Ollama · {importedModels.length} imported
                </span>
              </div>

              {allAvailableModelNames.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                  No local models discovered yet. Pull a tag above or import a Modelfile / .gguf file.
                </p>
              ) : (
                <div className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10">
                  {allAvailableModelNames.map((name) => {
                    const ollamaEntry = diagnostic.models.find((m) => m.name === name);
                    const profile = importedModels.find((m) => m.name === name);
                    const usedByChats = activeProject.conversations.filter(
                      (c) => c.model === name
                    ).length;
                    const isActiveChatModel = activeConversation?.model === name;
                    const isProjectDefault = activeProject.defaultModel === name;

                    return (
                      <div
                        key={name}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-mono font-semibold text-[#2B0F17] dark:text-[#FAF5EC]">
                              {name}
                            </span>
                            {isActiveChatModel && (
                              <span className="text-[11px] font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                                · Active Chat
                              </span>
                            )}
                            {isProjectDefault && (
                              <span className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                                · Project Default
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                            {ollamaEntry
                              ? `Ollama (${formatBytes(ollamaEntry.size) || 'installed'})`
                              : profile
                                ? `Custom ${profile.sourceType.toUpperCase()} profile`
                                : 'Workspace tag'}
                            {ollamaEntry?.details?.parameter_size
                              ? ` · ${ollamaEntry.details.parameter_size}`
                              : ''}
                            {ollamaEntry?.details?.quantization_level
                              ? ` · ${ollamaEntry.details.quantization_level}`
                              : ''}
                            {` · ${usedByChats} chats in ${activeProject.name}`}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchChatModel(name);
                              onBackToChat();
                            }}
                            className="h-8 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                          >
                            Use in Chat
                          </button>
                          {!isProjectDefault && (
                            <button
                              type="button"
                              onClick={() => onSetProjectDefaultModel(name)}
                              className="h-8 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                            >
                              Set Default
                            </button>
                          )}
                          {ollamaEntry && (
                            <button
                              type="button"
                              onClick={() => void handleInspectModel(name)}
                              title="Inspect Ollama /api/show details"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect</span>
                            </button>
                          )}
                          {(ollamaEntry || profile) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (ollamaEntry) {
                                  void handleDeleteFromOllama(name);
                                } else if (profile) {
                                  onDeleteImportedModel(profile.id);
                                }
                              }}
                              aria-label={`Remove ${name}`}
                              title={
                                ollamaEntry
                                  ? 'Delete from local Ollama'
                                  : 'Remove imported profile'
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#9E1B32] dark:hover:text-[#F899A9]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {inspectingModel && (
                <div className="mt-3 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/90 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold font-mono text-[#3A101B] dark:text-[#FAF5EC]">
                      /api/show · {inspectingModel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectingModel(null)}
                      className="text-xs text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                    >
                      Close
                    </button>
                  </div>
                  {isInspectLoading ? (
                    <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                      Loading model metadata...
                    </p>
                  ) : inspectError ? (
                    <p className="text-xs text-[#9E1B32] dark:text-[#F899A9]">
                      {inspectError}
                    </p>
                  ) : (
                    <pre className="max-h-52 overflow-auto rounded-lg border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-white/80 dark:bg-[#120509] p-3 text-xs font-mono text-[#2B0F17] dark:text-[#E8DAD0] whitespace-pre-wrap">
                      {inspectData?.modelfile ||
                        inspectData?.parameters ||
                        JSON.stringify(inspectData?.details || {}, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sync Status Banners */}
            {syncNotice && (
              <div className="flex items-center gap-2 rounded-xl border border-[#6B1D2F]/20 dark:border-[#E6B8A2]/25 bg-[#6B1D2F]/8 dark:bg-[#8C253E]/25 px-4 py-2.5 text-xs text-[#3A101B] dark:text-[#FAF5EC]">
                <Check className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0" />
                <span>{syncNotice}</span>
              </div>
            )}
            {syncError && (
              <div className="rounded-xl border border-[#9E1B32]/30 bg-[#9E1B32]/10 px-4 py-2.5 text-xs text-[#7A1326] dark:text-[#FBC2CB]">
                {syncError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Card 1: Cross-Platform Sync Bundle & Disk Auto-Sync */}
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    01. Workspace &amp; Chat Data Sync
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE] leading-relaxed">
                    Export or smart-merge all isolated projects, folders, chat histories, drafts, and imported model profiles across Windows and Linux.
                  </p>
                </div>

                {/* Live File System Sync (Chromium / Edge on Windows & Linux) */}
                <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/80 dark:bg-[#16080D]/75 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC]">
                      <HardDrive className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                      <span>Disk Auto-Sync File (Windows &amp; Linux)</span>
                    </div>
                    {linkedSyncFileName && (
                      <span className="text-[11px] font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">
                        Linked
                      </span>
                    )}
                  </div>

                  {linkedSyncFileName ? (
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-[#4D1422] dark:text-[#E8DAD0]">
                        File: {linkedSyncFileName}
                        {lastSyncedAt && (
                          <span className="text-[#6E4A53] dark:text-[#C5AE9F]">
                            {' '}
                            · Synced{' '}
                            {new Date(lastSyncedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const msg = await onPullFromLinkedSyncFile();
                            if (msg) setSyncNotice(msg);
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Pull &amp; Merge from File</span>
                        </button>
                        <button
                          type="button"
                          onClick={onUnlinkSyncFile}
                          className="h-8 rounded-lg px-2.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:underline"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                        {supportsFileSystemSync
                          ? 'Link a local .json file (e.g. inside Syncthing, Nextcloud, or OneDrive) to mirror every auto-save directly to disk.'
                          : 'Use Export / Import Sync Bundle below to sync data files across browsers or machines.'}
                      </p>
                      {supportsFileSystemSync && (
                        <button
                          type="button"
                          onClick={() => void onLinkLocalSyncFile()}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                        >
                          <FolderSync className="h-3.5 w-3.5" />
                          <span>Link Sync File on Disk</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Sync Bundle (.json)</span>
                  </button>
                  <a
                    href="/nimchesko-ai-studio-app.zip"
                    download="nimchesko-ai-studio-app.zip"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#16080D]/80 px-3.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    <span>Download Combined App (.zip)</span>
                  </a>
                </div>
              </div>

              {/* Card 2: Import External Chats or Sync Bundles */}
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    02. Import Chat Data Files
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE] leading-relaxed">
                    Import nimchesko AI studio <code className="font-mono">.json</code> backups, ChatGPT <code className="font-mono">conversations.json</code> exports, or Markdown (<code className="font-mono">.md</code>) and text transcripts.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Bind Imported Chat Transcripts to Model
                  </label>
                  <select
                    value={importTargetModel}
                    onChange={(e) => setImportTargetModel(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                  >
                    {allAvailableModelNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  ref={syncFileInputRef}
                  type="file"
                  accept=".json,.md,.markdown,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleImportChatOrSyncFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => syncFileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#6B1D2F]/30 dark:border-[#E6B8A2]/30 bg-[#FCF8F2]/60 dark:bg-[#16080D]/55 px-4 py-6 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:border-[#6B1D2F]/60 dark:hover:border-[#E6B8A2]/60 transition-colors"
                >
                  <Upload className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                  <span>Choose .json, .md, or .txt chat files to sync &amp; import</span>
                </button>
              </div>
            </div>

            {/* Card 3: Sync Project Chats to Any Imported Model */}
            <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    03. Sync Chats in {activeProject.name} with Local Models
                  </h2>
                  <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                    Rebind existing chat histories to run with any pulled or file-imported local model.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={batchTargetModel}
                    onChange={(e) => setBatchTargetModel(e.target.value)}
                    aria-label="Target model for chat sync"
                    className="h-8 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    {allAvailableModelNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const targetIds =
                        selectedChatIds.length > 0
                          ? selectedChatIds
                          : activeProject.conversations.map((c) => c.id);
                      onSyncProjectChatsToModel(targetIds, batchTargetModel);
                      setSyncNotice(
                        `Synced ${targetIds.length} chat(s) in "${activeProject.name}" to ${batchTargetModel}.`
                      );
                      setSelectedChatIds([]);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] whitespace-nowrap"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>
                      {selectedChatIds.length > 0
                        ? `Sync ${selectedChatIds.length} Selected`
                        : 'Sync All Chats'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-[#6B1D2F]/10 dark:divide-[#F3E7D8]/10 max-h-64 overflow-y-auto">
                {activeProject.conversations.map((conv) => {
                  const checked = selectedChatIds.includes(conv.id);
                  return (
                    <label
                      key={conv.id}
                      className="flex items-center justify-between gap-3 py-2.5 px-1 text-xs cursor-pointer hover:bg-[#6B1D2F]/5 dark:hover:bg-[#F3E7D8]/5 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedChatIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== conv.id)
                                : [...prev, conv.id]
                            )
                          }
                          className="accent-[#6B1D2F] dark:accent-[#E6B8A2] shrink-0"
                        />
                        <span className="truncate font-medium text-[#2B0F17] dark:text-[#F5ECE0]">
                          {conv.title}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F] shrink-0">
                        {conv.model} · {conv.messages.length} msgs
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
