import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  Check,
  Copy,
  CopyPlus,
  Download,
  Eye,
  FileCode2,
  FileText,
  FileUp,
  FolderKanban,
  Layers,
  MessageSquarePlus,
  Pencil,
  Plus,
  Server,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ConnectionDiagnostic,
  ImportedModelProfile,
  MotifId,
  ProjectContextItem,
  ProjectEnvVar,
  ProjectPrompt,
  PromptKind,
  WorkspaceProject,
} from '../types/ollama';
import { ProjectMotifIcon } from './PersianMotifs';
import { MarkdownRenderer } from './MarkdownRenderer';
import { composeSystemPrompt } from '../services/ollamaClient';
import { readAnyUploadedFiles } from '../services/fileUploads';

interface ProjectsViewProps {
  projects: WorkspaceProject[];
  activeProject: WorkspaceProject;
  diagnostic?: ConnectionDiagnostic;
  importedModels?: ImportedModelProfile[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: {
    name: string;
    description: string;
    motif: MotifId;
    defaultModel: string;
    brainPrompt: string;
  }) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateActiveProject: (
    updater: (prev: WorkspaceProject) => WorkspaceProject
  ) => void;
  onUsePromptInChat: (promptText: string) => void;
  onBackToChat: () => void;
}

type ProjectSectionTab = 'brain' | 'resources' | 'prompts' | 'environment';

const MOTIF_OPTIONS: Array<{ id: MotifId; label: string }> = [
  { id: 'persepolis', label: 'Persepolis' },
  { id: 'azadi', label: 'Azadi Tower' },
  { id: 'isfahan', label: 'Isfahan Dome' },
  { id: 'siosepol', label: 'Si-o-se-pol' },
  { id: 'shamseh', label: 'Shamseh' },
];

function downloadTextFile(filename: string, content: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSize(bytes?: number, chars?: number): string {
  const count = bytes ?? chars ?? 0;
  if (count >= 1024) return `${(count / 1024).toFixed(1)} KB`;
  return `${count} B`;
}

export function ProjectsView({
  projects,
  activeProject,
  diagnostic,
  importedModels = [],
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onUpdateActiveProject,
  onUsePromptInChat,
  onBackToChat,
}: ProjectsViewProps) {
  const allLocalModelNames = Array.from(
    new Set(
      [
        activeProject.defaultModel,
        ...(activeProject.enabledModels || []),
        ...(diagnostic?.models.map((m) => m.name) || []),
        ...importedModels.map((m) => m.name),
      ].filter(Boolean)
    )
  );
  const [sectionTab, setSectionTab] = useState<ProjectSectionTab>('brain');

  // New project creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMotif, setNewMotif] = useState<MotifId>('isfahan');
  const [newModel, setNewModel] = useState('');
  const [newBrainPrompt, setNewBrainPrompt] = useState(
    'You operate strictly within this isolated project workspace. Follow project rules.md, resource files, and system connectors.'
  );

  // Rules.md editor/preview state
  const [rulesMode, setRulesMode] = useState<'write' | 'preview'>('write');
  const rulesFileRef = useRef<HTMLInputElement>(null);

  // Resource files state
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resFilename, setResFilename] = useState('');
  const [resContent, setResContent] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const resourceFileRef = useRef<HTMLInputElement>(null);

  // Project prompts state
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptCategory, setPromptCategory] = useState('General');
  const [promptKind, setPromptKind] = useState<PromptKind>('query');
  const [promptContent, setPromptContent] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const promptFileRef = useRef<HTMLInputElement>(null);

  // Env vars state
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const handleCreateSubmit = () => {
    if (!newName.trim()) return;
    onCreateProject({
      name: newName.trim(),
      description:
        newDescription.trim() ||
        'Isolated project workspace with dedicated chat histories, rules.md, resource files, prompts, and environment.',
      motif: newMotif,
      defaultModel: newModel.trim(),
      brainPrompt: newBrainPrompt.trim(),
    });
    setNewName('');
    setNewDescription('');
    setShowCreateForm(false);
  };

  // Rules handlers
  const handleImportRulesMarkdown = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    onUpdateActiveProject((proj) => ({
      ...proj,
      rulesMarkdown: text,
      rulesEnabled: true,
      updatedAt: Date.now(),
    }));
  };

  // Resource files handlers
  const handleImportResourceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded = await readAnyUploadedFiles(files);
    const imported: ProjectContextItem[] = uploaded.map((u) => {
      const content =
        u.textContent ||
        (u.kind === 'image'
          ? `[Image resource: ${u.name} (${u.mimeType}, ${u.sizeBytes} bytes)]`
          : `[Binary resource: ${u.name} (${u.mimeType}, ${u.sizeBytes} bytes)]`);
      return {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: u.name.replace(/\.[^.]+$/, ''),
        filename: u.name,
        source: 'file',
        sizeBytes: u.sizeBytes || content.length,
        content: content.trim().slice(0, 32000),
        enabled: true,
        updatedAt: Date.now(),
      };
    });
    if (imported.length > 0) {
      onUpdateActiveProject((proj) => ({
        ...proj,
        contextItems: [...imported, ...proj.contextItems],
        updatedAt: Date.now(),
      }));
    }
  };

  const handleOpenNewResource = () => {
    setEditingResourceId(null);
    setResTitle('');
    setResFilename('');
    setResContent('');
    setShowResourceForm(true);
  };

  const handleEditResource = (item: ProjectContextItem) => {
    setEditingResourceId(item.id);
    setResTitle(item.title);
    setResFilename(item.filename || '');
    setResContent(item.content);
    setShowResourceForm(true);
  };

  const handleSaveResource = () => {
    if (!resTitle.trim() || !resContent.trim()) return;
    const cleanFilename = resFilename.trim() || undefined;
    const content = resContent.trim();

    if (editingResourceId) {
      onUpdateActiveProject((proj) => ({
        ...proj,
        contextItems: proj.contextItems.map((c) =>
          c.id === editingResourceId
            ? {
                ...c,
                title: resTitle.trim(),
                filename: cleanFilename,
                content,
                sizeBytes: new Blob([content]).size,
                updatedAt: Date.now(),
              }
            : c
        ),
        updatedAt: Date.now(),
      }));
    } else {
      const item: ProjectContextItem = {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: resTitle.trim(),
        filename: cleanFilename,
        source: cleanFilename ? 'file' : 'note',
        sizeBytes: new Blob([content]).size,
        content,
        enabled: true,
        updatedAt: Date.now(),
      };
      onUpdateActiveProject((proj) => ({
        ...proj,
        contextItems: [item, ...proj.contextItems],
        updatedAt: Date.now(),
      }));
    }

    setShowResourceForm(false);
    setEditingResourceId(null);
    setResTitle('');
    setResFilename('');
    setResContent('');
  };

  const handleToggleResource = (id: string) => {
    onUpdateActiveProject((proj) => ({
      ...proj,
      contextItems: proj.contextItems.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      ),
      updatedAt: Date.now(),
    }));
  };

  const handleDeleteResource = (id: string) => {
    onUpdateActiveProject((proj) => ({
      ...proj,
      contextItems: proj.contextItems.filter((c) => c.id !== id),
      updatedAt: Date.now(),
    }));
  };

  // Prompts handlers
  const handleOpenNewPrompt = () => {
    setEditingPromptId(null);
    setPromptTitle('');
    setPromptCategory('General');
    setPromptKind('query');
    setPromptContent('');
    setShowPromptForm(true);
  };

  const handleEditPrompt = (p: ProjectPrompt) => {
    setEditingPromptId(p.id);
    setPromptTitle(p.title);
    setPromptCategory(p.category || 'General');
    setPromptKind(p.kind === 'system' ? 'system' : 'query');
    setPromptContent(p.content);
    setShowPromptForm(true);
  };

  const handleSavePrompt = () => {
    if (!promptTitle.trim() || !promptContent.trim()) return;
    if (editingPromptId) {
      onUpdateActiveProject((proj) => ({
        ...proj,
        prompts: proj.prompts.map((p) =>
          p.id === editingPromptId
            ? {
                ...p,
                title: promptTitle.trim(),
                category: promptCategory.trim() || 'General',
                kind: promptKind,
                content: promptContent.trim(),
                updatedAt: Date.now(),
              }
            : p
        ),
        updatedAt: Date.now(),
      }));
    } else {
      const next: ProjectPrompt = {
        id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: promptTitle.trim(),
        category: promptCategory.trim() || 'General',
        kind: promptKind,
        content: promptContent.trim(),
        updatedAt: Date.now(),
      };
      onUpdateActiveProject((proj) => ({
        ...proj,
        prompts: [next, ...proj.prompts],
        updatedAt: Date.now(),
      }));
    }
    setShowPromptForm(false);
    setEditingPromptId(null);
    setPromptTitle('');
    setPromptCategory('General');
    setPromptKind('query');
    setPromptContent('');
  };

  const handleImportPromptFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const cleanTitle = file.name.replace(/\.(md|txt)$/i, '').replace(/[-_]+/g, ' ');
    const headingMatch = /^#\s+(.+)$/m.exec(text);
    const next: ProjectPrompt = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: headingMatch ? headingMatch[1].trim() : cleanTitle || 'Imported Prompt',
      category: 'Imported',
      content: text.trim(),
      updatedAt: Date.now(),
    };
    onUpdateActiveProject((proj) => ({
      ...proj,
      prompts: [next, ...proj.prompts],
      updatedAt: Date.now(),
    }));
  };

  const handleDeletePrompt = (id: string) => {
    onUpdateActiveProject((proj) => ({
      ...proj,
      prompts: proj.prompts.filter((p) => p.id !== id),
      updatedAt: Date.now(),
    }));
  };

  const handleCopyPrompt = async (p: ProjectPrompt) => {
    try {
      await navigator.clipboard.writeText(p.content);
      setCopiedPromptId(p.id);
      window.setTimeout(() => setCopiedPromptId(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  // Env handlers
  const handleAddEnvVar = () => {
    const cleanKey = newEnvKey
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_');
    if (!cleanKey) return;
    const entry: ProjectEnvVar = {
      id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      key: cleanKey,
      value: newEnvValue,
    };
    onUpdateActiveProject((proj) => ({
      ...proj,
      envVars: [...proj.envVars, entry],
      updatedAt: Date.now(),
    }));
    setNewEnvKey('');
    setNewEnvValue('');
  };

  const handleUpdateEnvVar = (
    id: string,
    patch: Partial<Pick<ProjectEnvVar, 'key' | 'value'>>
  ) => {
    onUpdateActiveProject((proj) => ({
      ...proj,
      envVars: proj.envVars.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      updatedAt: Date.now(),
    }));
  };

  const handleDeleteEnvVar = (id: string) => {
    onUpdateActiveProject((proj) => ({
      ...proj,
      envVars: proj.envVars.filter((e) => e.id !== id),
      updatedAt: Date.now(),
    }));
  };

  const activeConversation =
    activeProject.conversations.find(
      (c) => c.id === activeProject.activeConversationId
    ) || activeProject.conversations[0];

  const compiledBrainPreview = composeSystemPrompt(
    activeConversation?.systemPrompt || '',
    activeProject.skills,
    {
      projectName: activeProject.name,
      brainPrompt: activeProject.brainPrompt,
      rulesMarkdown: activeProject.rulesMarkdown,
      rulesEnabled: activeProject.rulesEnabled,
      contextItems: activeProject.contextItems,
      envVars: activeProject.envVars,
    }
  );

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center justify-center rounded-2xl border border-[#6B1D2F]/15 dark:border-[#F3E7D8]/15 bg-[#FCF8F2]/80 dark:bg-[#230D14]/80 p-3 text-[#6B1D2F] dark:text-[#E6B8A2]">
              <ProjectMotifIcon motif={activeProject.motif} className="h-9 w-11" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Isolated Projects &amp; Workspace Files
              </h1>
              <p className="mt-2 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Manage isolated project groups, edit Markdown rules (<code className="font-mono text-xs">rules.md</code>), attach resource files, and build reusable prompts.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[#6E4A53] dark:text-[#CEB8AE] tabular-nums">
                <span>Active: {activeProject.name}</span>
                <span aria-hidden="true">·</span>
                <span>{activeProject.conversations.length} chats</span>
                <span aria-hidden="true">·</span>
                <span>{activeProject.contextItems.filter((c) => c.enabled).length} resources</span>
                <span aria-hidden="true">·</span>
                <span>{activeProject.prompts.length} prompts</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Project</span>
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

        {/* Create Project Form */}
        {showCreateForm && (
          <div className="rounded-2xl border border-[#6B1D2F]/22 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#240D15]/85 backdrop-blur-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Create Isolated Project Workspace
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Research Lab"
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Default Model
                </label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="llama3.2:latest or local tag"
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Architectural Emblem
                </label>
                <select
                  value={newMotif}
                  onChange={(e) => setNewMotif(e.target.value as MotifId)}
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-2.5 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                >
                  {MOTIF_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                Workspace Description
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Purpose of this isolated history group..."
                className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                Initial Brain Instructions
              </label>
              <textarea
                rows={3}
                value={newBrainPrompt}
                onChange={(e) => setNewBrainPrompt(e.target.value)}
                className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 py-2 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-4 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={!newName.trim()}
                className="h-9 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40"
              >
                Create Project
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Project Directory */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
              01. Project Groups
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map((proj) => {
              const isSelected = proj.id === activeProject.id;
              return (
                <div
                  key={proj.id}
                  className={`rounded-2xl border backdrop-blur-md p-4 transition-colors ${
                    isSelected
                      ? 'border-[#6B1D2F]/45 dark:border-[#E6B8A2]/45 bg-[#6B1D2F]/[0.07] dark:bg-[#8C253E]/20'
                      : 'border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <ProjectMotifIcon
                        motif={proj.motif}
                        className="h-8 w-10 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0] truncate">
                          {proj.name}
                        </div>
                        <div className="mt-0.5 text-xs text-[#6E4A53] dark:text-[#CEB8AE] line-clamp-2">
                          {proj.description}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                          <span>{proj.conversations.length} chats</span>
                          <span aria-hidden="true">·</span>
                          <span>{proj.contextItems.filter((c) => c.enabled).length} files</span>
                          <span aria-hidden="true">·</span>
                          <span>{proj.prompts.length} prompts</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectProject(proj.id)}
                        className={`h-8 rounded-xl px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                            : 'border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]'
                        }`}
                      >
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          'Switch'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(proj.id)}
                        aria-label={`Clone ${proj.name}`}
                        title="Clone project"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </button>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          aria-label={`Delete ${proj.name}`}
                          title="Delete project"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active Project Workspace Sub-Navigation */}
        <div className="border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/7 p-1 border border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10">
              <button
                type="button"
                onClick={() => setSectionTab('brain')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sectionTab === 'brain'
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                <span>Brain &amp; rules.md</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('resources')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sectionTab === 'resources'
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Resource Files ({activeProject.contextItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('prompts')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sectionTab === 'prompts'
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Prompts ({activeProject.prompts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('environment')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sectionTab === 'environment'
                    ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                    : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                <span>Environment</span>
              </button>
            </div>
          </div>

          {/* SUBTAB 1: BRAIN & RULES.MD */}
          {sectionTab === 'brain' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/70 backdrop-blur-md p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                  <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    Project Identity &amp; Brain — {activeProject.name}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={activeProject.name}
                      onChange={(e) =>
                        onUpdateActiveProject((p) => ({
                          ...p,
                          name: e.target.value,
                          updatedAt: Date.now(),
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Default Model Tag
                    </label>
                    <input
                      type="text"
                      value={activeProject.defaultModel}
                      onChange={(e) =>
                        onUpdateActiveProject((p) => ({
                          ...p,
                          defaultModel: e.target.value,
                          updatedAt: Date.now(),
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Motif Emblem
                    </label>
                    <select
                      value={activeProject.motif}
                      onChange={(e) =>
                        onUpdateActiveProject((p) => ({
                          ...p,
                          motif: e.target.value as MotifId,
                          updatedAt: Date.now(),
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-2.5 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    >
                      {MOTIF_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1.5">
                    Project Multi-Model Pool ({(activeProject.enabledModels || []).length} selected)
                  </label>
                  {allLocalModelNames.length === 0 ? (
                    <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                      Connect Ollama or import local models to assign multiple models to this project.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allLocalModelNames.map((name) => {
                        const checked = (activeProject.enabledModels || []).includes(name);
                        return (
                          <label
                            key={name}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                              checked
                                ? 'border-[#6B1D2F]/45 bg-[#6B1D2F]/10 dark:bg-[#8C253E]/25 text-[#3A101B] dark:text-[#FAF5EC]'
                                : 'border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 text-[#5C3A42] dark:text-[#CEB8AE]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                onUpdateActiveProject((p) => {
                                  const current = p.enabledModels || [];
                                  const next = current.includes(name)
                                    ? current.filter((m) => m !== name)
                                    : [...current, name];
                                  return {
                                    ...p,
                                    enabledModels: next,
                                    updatedAt: Date.now(),
                                  };
                                })
                              }
                              className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Core Brain Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={activeProject.brainPrompt}
                    onChange={(e) =>
                      onUpdateActiveProject((p) => ({
                        ...p,
                        brainPrompt: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    placeholder="Define persona, architecture rules, and reasoning style for this project..."
                    className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 py-2 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Markdown Rules File Editor (rules.md) */}
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/70 backdrop-blur-md p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCode2 className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                      <h3 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                        Project Rules (<code className="font-mono text-sm">rules.md</code>)
                      </h3>
                    </div>
                    <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                      Write project guidelines in Markdown. When active, <code className="font-mono">rules.md</code> is injected into every conversation inside {activeProject.name}.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={rulesFileRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => {
                        void handleImportRulesMarkdown(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => rulesFileRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      <span>Import .md</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile('rules.md', activeProject.rulesMarkdown || '')
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export rules.md</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveProject((p) => ({
                          ...p,
                          rulesEnabled: !p.rulesEnabled,
                          updatedAt: Date.now(),
                        }))
                      }
                      className={`h-8 rounded-xl px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                        activeProject.rulesEnabled
                          ? 'bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                          : 'border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0]'
                      }`}
                    >
                      {activeProject.rulesEnabled ? 'Active in Brain' : 'Paused'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-2">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/7 p-0.5">
                    <button
                      type="button"
                      onClick={() => setRulesMode('write')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        rulesMode === 'write'
                          ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC]'
                          : 'text-[#6E4A53] dark:text-[#CEB8AE]'
                      }`}
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Write Markdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulesMode('preview')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        rulesMode === 'preview'
                          ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC]'
                          : 'text-[#6E4A53] dark:text-[#CEB8AE]'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    {activeProject.rulesMarkdown.length} chars
                  </span>
                </div>

                {rulesMode === 'write' ? (
                  <textarea
                    rows={10}
                    value={activeProject.rulesMarkdown}
                    onChange={(e) =>
                      onUpdateActiveProject((p) => ({
                        ...p,
                        rulesMarkdown: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    placeholder="# Project Rules&#10;&#10;- Always validate inputs&#10;- Follow clean TypeScript conventions"
                    className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-3.5 text-sm font-mono leading-relaxed text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                ) : (
                  <div className="min-h-[220px] rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/75 dark:bg-[#16080D]/75 p-4">
                    {activeProject.rulesMarkdown.trim() ? (
                      <MarkdownRenderer content={activeProject.rulesMarkdown} />
                    ) : (
                      <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                        rules.md is empty. Switch to Write Markdown to author project rules.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 2: RESOURCE FILES */}
          {sectionTab === 'resources' && (
            <div
              className="space-y-4"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFiles(false);
                void handleImportResourceFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    Project Resource Files
                  </h2>
                  <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                    Attach specs, schemas, code files, or Markdown docs. Drag &amp; drop files anywhere here or create inline notes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={resourceFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleImportResourceFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => resourceFileRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    <span>Upload Resource Files</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewResource}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Note</span>
                  </button>
                </div>
              </div>

              {/* Dropzone hint */}
              <div
                onClick={() => resourceFileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    resourceFileRef.current?.click();
                  }
                }}
                className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center transition-colors ${
                  isDraggingFiles
                    ? 'border-[#6B1D2F] dark:border-[#E6B8A2] bg-[#6B1D2F]/[0.08] dark:bg-[#8C253E]/25'
                    : 'border-[#6B1D2F]/22 dark:border-[#F3E7D8]/18 bg-[#FAF5EC]/50 dark:bg-[#230D14]/45 hover:border-[#6B1D2F]/45 dark:hover:border-[#E6B8A2]/40'
                }`}
              >
                <FileUp className="mx-auto h-5 w-5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <p className="mt-1.5 text-xs font-medium text-[#3A101B] dark:text-[#F5ECE0]">
                  Drop resource files here or click to browse
                </p>
                <p className="mt-0.5 text-[11px] text-[#6E4A53] dark:text-[#CEB8AE]">
                  Supports .md, .txt, .json, .csv, .ts, .py, .sql, .yaml, and other text source files
                </p>
              </div>

              {showResourceForm && (
                <div className="rounded-2xl border border-[#6B1D2F]/22 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#240D15]/85 backdrop-blur-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      {editingResourceId ? 'Edit Resource' : 'New Resource File / Note'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowResourceForm(false)}
                      className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={resTitle}
                        onChange={(e) => setResTitle(e.target.value)}
                        placeholder="e.g. Database Schema"
                        className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                        Filename (optional)
                      </label>
                      <input
                        type="text"
                        value={resFilename}
                        onChange={(e) => setResFilename(e.target.value)}
                        placeholder="e.g. schema.sql"
                        className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Content
                    </label>
                    <textarea
                      rows={6}
                      value={resContent}
                      onChange={(e) => setResContent(e.target.value)}
                      placeholder="Paste file contents, specifications, or domain facts..."
                      className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 py-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResourceForm(false)}
                      className="h-8 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveResource}
                      disabled={!resTitle.trim() || !resContent.trim()}
                      className="h-8 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] disabled:opacity-40"
                    >
                      Save Resource
                    </button>
                  </div>
                </div>
              )}

              {activeProject.contextItems.length === 0 ? (
                <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/60 dark:bg-[#230D14]/60 p-6 text-center text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                  No resource files attached to {activeProject.name} yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeProject.contextItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border backdrop-blur-md p-4 transition-colors ${
                        item.enabled
                          ? 'border-[#6B1D2F]/35 dark:border-[#E6B8A2]/35 bg-[#6B1D2F]/[0.06] dark:bg-[#8C253E]/16'
                          : 'border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <FileText className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6E4A53] dark:text-[#C5AE9F] font-mono tabular-nums">
                              <span>{item.filename || 'inline-note.md'}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatSize(item.sizeBytes, item.content.length)}</span>
                            </div>
                            <h3 className="mt-0.5 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0] truncate">
                              {item.title}
                            </h3>
                            <p className="mt-1 text-xs font-mono text-[#5C3A42] dark:text-[#CEB8AE] line-clamp-3 whitespace-pre-wrap">
                              {item.content}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditResource(item)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadTextFile(
                                item.filename || `${item.title.toLowerCase().replace(/\s+/g, '-')}.md`,
                                item.content,
                                'text/plain;charset=utf-8'
                              )
                            }
                            aria-label={`Download ${item.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleResource(item.id)}
                            className={`h-8 rounded-xl px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                              item.enabled
                                ? 'bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                                : 'border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0]'
                            }`}
                          >
                            {item.enabled ? 'Active' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(item.id)}
                            aria-label={`Remove ${item.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: PROJECT PROMPTS */}
          {sectionTab === 'prompts' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    Project Prompts Library
                  </h2>
                  <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                    Save reusable prompts scoped to {activeProject.name} and launch them directly in the chat composer.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={promptFileRef}
                    type="file"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      void handleImportPromptFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => promptFileRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    <span>Import .md</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewPrompt}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Write Prompt</span>
                  </button>
                </div>
              </div>

              {showPromptForm && (
                <div className="rounded-2xl border border-[#6B1D2F]/22 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#240D15]/85 backdrop-blur-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      {editingPromptId ? 'Edit Prompt' : 'New Project Prompt'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPromptForm(false)}
                      className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                        Prompt Title
                      </label>
                      <input
                        type="text"
                        value={promptTitle}
                        onChange={(e) => setPromptTitle(e.target.value)}
                        placeholder="e.g. Generate API Migration Plan"
                        className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                        Prompt Type
                      </label>
                      <select
                        value={promptKind}
                        onChange={(e) => setPromptKind(e.target.value as PromptKind)}
                        className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-2.5 text-sm text-[#2B0F17] dark:text-[#F5ECE0]"
                      >
                        <option value="query">User Query</option>
                        <option value="system">System Prompt</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={promptCategory}
                        onChange={(e) => setPromptCategory(e.target.value)}
                        placeholder="Architecture / Review / Testing"
                        className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Prompt Content (Markdown supported)
                    </label>
                    <textarea
                      rows={5}
                      value={promptContent}
                      onChange={(e) => setPromptContent(e.target.value)}
                      placeholder="Write your prompt template here..."
                      className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 py-2 text-sm text-[#2B0F17] dark:text-[#F5ECE0]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPromptForm(false)}
                      className="h-8 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      disabled={!promptTitle.trim() || !promptContent.trim()}
                      className="h-8 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] disabled:opacity-40"
                    >
                      Save Prompt
                    </button>
                  </div>
                </div>
              )}

              {activeProject.prompts.length === 0 ? (
                <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/60 dark:bg-[#230D14]/60 p-6 text-center text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                  No prompts saved for {activeProject.name} yet. Click Write Prompt to create your first reusable template.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeProject.prompts.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                          {p.kind === 'system' ? 'System Prompt' : 'User Query'} · {p.category || 'General'}
                        </div>
                        <h3 className="mt-0.5 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                          {p.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-[#5C3A42] dark:text-[#CEB8AE] leading-relaxed line-clamp-4 whitespace-pre-wrap">
                          {p.content}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-2.5">
                        <button
                          type="button"
                          onClick={() => onUsePromptInChat(p.content)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          <span>Use in Chat</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(p)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10"
                          >
                            {copiedPromptId === p.id ? (
                              <>
                                <Check className="h-3 w-3 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditPrompt(p)}
                            aria-label={`Edit ${p.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(p.id)}
                            aria-label={`Delete ${p.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: ENVIRONMENT & COMPILED PAYLOAD */}
          {sectionTab === 'environment' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/70 backdrop-blur-md p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Project Ollama Endpoint
                  </label>
                  <input
                    type="url"
                    value={activeProject.baseUrl}
                    onChange={(e) =>
                      onUpdateActiveProject((p) => ({
                        ...p,
                        baseUrl: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    placeholder="http://localhost:11434"
                    className="h-9 w-full sm:w-80 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2]">
                    Environment Variables (interpolated via <code className="font-mono">{'{{env.KEY}}'}</code>)
                  </div>

                  {activeProject.envVars.length > 0 && (
                    <div className="space-y-2">
                      {activeProject.envVars.map((env) => (
                        <div
                          key={env.id}
                          className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center"
                        >
                          <input
                            type="text"
                            value={env.key}
                            onChange={(e) =>
                              handleUpdateEnvVar(env.id, {
                                key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]+/g, '_'),
                              })
                            }
                            placeholder="VARIABLE_KEY"
                            className="sm:col-span-4 h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                          />
                          <input
                            type="text"
                            value={env.value}
                            onChange={(e) =>
                              handleUpdateEnvVar(env.id, { value: e.target.value })
                            }
                            placeholder="value"
                            className="sm:col-span-7 h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteEnvVar(env.id)}
                            aria-label={`Delete ${env.key}`}
                            className="sm:col-span-1 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center pt-1">
                    <input
                      type="text"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="NEW_ENV_KEY"
                      className="sm:col-span-4 h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                    />
                    <input
                      type="text"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      placeholder="https://api.example.local"
                      className="sm:col-span-6 h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#16080D]/80 px-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                    />
                    <button
                      type="button"
                      onClick={handleAddEnvVar}
                      disabled={!newEnvKey.trim()}
                      className="sm:col-span-2 inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40 whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Var</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                  Compiled Project Brain, Rules &amp; Resources Payload
                </h3>
                <pre className="max-h-60 overflow-y-auto rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md p-4 text-xs font-mono leading-relaxed text-[#3A101B] dark:text-[#F5ECE0] whitespace-pre-wrap">
                  {compiledBrainPreview || '(No brain prompt, rules.md, resources, or active skills configured)'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
