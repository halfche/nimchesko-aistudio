import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderCheck,
  FolderOpen,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ConnectionDiagnostic,
  ImportedModelProfile,
  JournalCategory,
  JournalSkillEntry,
  SkillModule,
  UploadedFileAttachment,
  WorkspaceProject,
} from '../types/ollama';
import { streamOllamaChat } from '../services/ollamaClient';
import { readAnyUploadedFiles } from '../services/fileUploads';
import {
  JOURNAL_FOLDER_NAME,
  openDesktopSubfolder,
  saveMarkdownToDesktopFolder,
  triggerMarkdownDownload,
  type DesktopDirectoryHandleLike,
} from '../services/desktopFiles';
import { MarkdownRenderer } from './MarkdownRenderer';
import { IsfahanDomeMotif, SiOSePolMotif } from './PersianMotifs';

interface JournalCreativeViewProps {
  project: WorkspaceProject;
  diagnostic: ConnectionDiagnostic;
  importedModels: ImportedModelProfile[];
  entries: JournalSkillEntry[];
  activeEntryId: string;
  onSelectEntry: (id: string) => void;
  onCreateEntry: (entry: JournalSkillEntry) => void;
  onUpdateEntry: (
    id: string,
    updater: (prev: JournalSkillEntry) => JournalSkillEntry
  ) => void;
  onDeleteEntry: (id: string) => void;
  onAttachSkillToProject: (skill: SkillModule) => void;
  desktopDirHandle: DesktopDirectoryHandleLike | null;
  onLinkDesktopFolder: () => Promise<DesktopDirectoryHandleLike | null>;
  onOpenSkills: () => void;
  onBackToChat: () => void;
}

const CATEGORIES: JournalCategory[] = [
  'Skill Module',
  'Model Bridge',
  'Journal Note',
  'Creative Prompt',
];

export function JournalCreativeView({
  project,
  diagnostic,
  importedModels,
  entries,
  activeEntryId,
  onSelectEntry,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAttachSkillToProject,
  desktopDirHandle,
  onLinkDesktopFolder,
  onOpenSkills,
  onBackToChat,
}: JournalCreativeViewProps) {
  const allModelNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of diagnostic.models) names.add(m.name);
    for (const p of importedModels) names.add(p.name);
    if (project.defaultModel) names.add(project.defaultModel);
    for (const em of project.enabledModels || []) names.add(em);
    return Array.from(names).filter(Boolean);
  }, [diagnostic.models, importedModels, project.defaultModel, project.enabledModels]);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) || entries[0],
    [entries, activeEntryId]
  );

  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<JournalCategory>('Skill Module');
  const [newModel, setNewModel] = useState(() => allModelNames[0] || '');

  const [linkInput, setLinkInput] = useState('');
  const [editMode, setEditMode] = useState<'write' | 'preview'>('write');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attachedToProjectTick, setAttachedToProjectTick] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isElectron =
    typeof window !== 'undefined' && Boolean(window.nimcheskoDesktop?.isElectron);

  const handleConfirmCreate = () => {
    const clean = newName.trim();
    if (!clean) return;
    const now = Date.now();
    const created: JournalSkillEntry = {
      id: `journal-${now}-${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      category: newCategory,
      model: newModel || allModelNames[0] || '',
      sourceSide: 'Side A (Input / Local Model / File)',
      targetSide: 'Side B (Destination System / Model / API)',
      links: [],
      prompt: '',
      markdownContent: `# ${clean}\n\n## Purpose\nDescribe how this skill or creative bridge operates across your local models.\n\n## Connection Bridge (Side A -> Side B)\n- Source Side: \n- Target Side: \n\n## Instructions\n`,
      attachments: [],
      targetModels: [],
      attachedProjectIds: [],
      createdAt: now,
      updatedAt: now,
    };
    onCreateEntry(created);
    setShowNewModal(false);
  };

  const handleAttachFiles = async (fileList: FileList | null) => {
    if (!activeEntry || !fileList || fileList.length === 0) return;
    const uploaded: UploadedFileAttachment[] = await readAnyUploadedFiles(fileList);
    if (uploaded.length === 0) return;
    onUpdateEntry(activeEntry.id, (prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...uploaded],
      updatedAt: Date.now(),
    }));
  };

  const handleAddLink = () => {
    if (!activeEntry || !linkInput.trim()) return;
    const clean = linkInput.trim();
    onUpdateEntry(activeEntry.id, (prev) => ({
      ...prev,
      links: Array.from(new Set([...prev.links, clean])),
      updatedAt: Date.now(),
    }));
    setLinkInput('');
  };

  const handleGenerateSkillMarkdown = async () => {
    if (!activeEntry || isGenerating) return;
    const model = activeEntry.model.trim() || allModelNames[0] || '';
    if (!model) {
      setSaveFeedback('Select a local model to generate or enhance Markdown.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setSaveFeedback(null);
    setEditMode('preview');

    const bridgeBlock = [
      `Entry Name: ${activeEntry.name}`,
      `Category: ${activeEntry.category}`,
      `Connecting Side A -> Side B: ${activeEntry.sourceSide} -> ${activeEntry.targetSide}`,
      activeEntry.links.length > 0
        ? `Reference Links:\n${activeEntry.links.map((l) => `- ${l}`).join('\n')}`
        : '',
      activeEntry.prompt.trim()
        ? `Creative / Skill Goal:\n${activeEntry.prompt.trim()}`
        : '',
      activeEntry.markdownContent.trim()
        ? `Current Draft:\n${activeEntry.markdownContent.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const userMsg: ChatMessage = {
      id: `jrn-u-${Date.now()}`,
      role: 'user',
      content: bridgeBlock,
      files: activeEntry.attachments,
      createdAt: Date.now(),
    };

    try {
      await streamOllamaChat({
        baseUrl: project.baseUrl,
        model,
        systemPrompt: [
          `You are creating a reusable SKILL.md / Creative Bridge Markdown file for local models.`,
          `Write in the exact language of the user's request.`,
          `Structure it clearly with: Title, Category, Side-to-Side Connection Contract (Side A -> Side B), Reference Links, Step-by-Step Instructions that any local model can execute directly, Inputs/Outputs, and Examples.`,
          `Return clean Markdown only.`,
        ].join('\n\n'),
        messages: [userMsg],
        params: { ...project.params, toolsEnabled: false },
        signal: controller.signal,
        onChunk: ({ content }) => {
          onUpdateEntry(activeEntry.id, (prev) => ({
            ...prev,
            markdownContent: content,
            updatedAt: Date.now(),
          }));
        },
        onComplete: () => {
          // Completed
        },
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setSaveFeedback(
          err instanceof Error ? err.message : 'Model generation failed.'
        );
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const buildFullSkillMarkdown = (entry: JournalSkillEntry): string => {
    const parts = [
      `# ${entry.name}`,
      '',
      `- **Category:** ${entry.category}`,
      `- **Bridge:** ${entry.sourceSide || 'Side A'} -> ${entry.targetSide || 'Side B'}`,
      entry.model ? `- **Authored With Model:** \`${entry.model}\`` : '',
      entry.links.length > 0
        ? `\n## Connected Links\n${entry.links.map((l) => `- ${l}`).join('\n')}`
        : '',
      '',
      entry.markdownContent.trim(),
      '',
    ].filter((line) => line !== undefined);
    return parts.join('\n');
  };

  const handleSaveToDesktop = async (allowDownload = true) => {
    if (!activeEntry) return;
    const fullDoc = buildFullSkillMarkdown(activeEntry);
    const res = await saveMarkdownToDesktopFolder({
      folderName: JOURNAL_FOLDER_NAME,
      fileName: `${activeEntry.name}.skill`,
      content: fullDoc,
      desktopDirHandle,
      fallbackDownload: allowDownload,
    });
    if (res.ok) {
      onUpdateEntry(activeEntry.id, (prev) => ({
        ...prev,
        savedFilePath: res.savedPath,
        updatedAt: Date.now(),
      }));
      setSaveFeedback(`Saved to ${res.savedPath}`);
    }
  };

  const handleSyncToProjectSkills = () => {
    if (!activeEntry) return;
    const fullDoc = buildFullSkillMarkdown(activeEntry);
    const skillObj: SkillModule = {
      id: `journal-skill-${activeEntry.id}`,
      name: activeEntry.name,
      category: activeEntry.category,
      description: `${activeEntry.sourceSide} -> ${activeEntry.targetSide}${
        activeEntry.links.length > 0 ? ` (${activeEntry.links.length} links)` : ''
      }`,
      instructions: fullDoc,
      enabled: true,
    };
    onAttachSkillToProject(skillObj);
    onUpdateEntry(activeEntry.id, (prev) => ({
      ...prev,
      attachedProjectIds: Array.from(
        new Set([...(prev.attachedProjectIds || []), project.id])
      ),
      updatedAt: Date.now(),
    }));
    setAttachedToProjectTick(true);
    setSaveFeedback(
      `Skill "${activeEntry.name}" attached to ${project.name} — active for all models in Chatbot, Compare, & Hyper Mode.`
    );
    window.setTimeout(() => setAttachedToProjectTick(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <IsfahanDomeMotif className="h-10 w-12" />
              <SiOSePolMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                Creative Studio · Skills &amp; Side-to-Side Model Bridges
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Journal &amp; Skill Mode
              </h1>
              <p className="mt-1.5 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Author creative notes, link side-to-side workflows (<code className="font-mono text-xs">Side A -&gt; Side B</code>), attach reference URLs and files, generate Markdown skills with any local model, attach them to your models, and save into{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14">
                  Desktop/{JOURNAL_FOLDER_NAME}
                </code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isElectron && (
              <button
                type="button"
                onClick={() => void onLinkDesktopFolder()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
              >
                {desktopDirHandle ? (
                  <>
                    <FolderCheck className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    <span>Folder: {desktopDirHandle.name}</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    <span>Link Desktop Folder</span>
                  </>
                )}
              </button>
            )}

            {isElectron && (
              <button
                type="button"
                onClick={() => void openDesktopSubfolder(JOURNAL_FOLDER_NAME)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Open Desktop Folder</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSkills}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
            >
              <Wrench className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
              <span>Project Skills ({project.skills.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewName('');
                setNewModel(allModelNames[0] || '');
                setShowNewModal(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Skill / Journal</span>
            </button>

            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        {/* Entries list */}
        <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
              <BookOpen className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
              <span>Named Skills &amp; Journals ({entries.length})</span>
            </div>
            {saveFeedback && (
              <span className="text-xs font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">
                {saveFeedback}
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#6B1D2F]/22 dark:border-[#F3E7D8]/20 p-5 text-center space-y-2">
              <p className="text-sm font-medium text-[#3A101B] dark:text-[#F5ECE0]">
                No named skills or journal bridges yet
              </p>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                Create a named skill to capture creative workflows, connect two sides, save to Desktop/{JOURNAL_FOLDER_NAME}, and attach to any model.
              </p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Named Skill / Journal</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map((entry) => {
                const isActive = entry.id === activeEntry?.id;
                const isAttachedHere = (entry.attachedProjectIds || []).includes(project.id);
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'border-[#6B1D2F]/50 bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                        : 'border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 text-[#3A101B] dark:text-[#F5ECE0]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry.id)}
                      className="font-medium truncate max-w-[180px]"
                    >
                      {entry.name}
                    </button>
                    <span className="text-[10px] opacity-80">{entry.category}</span>
                    {isAttachedHere && (
                      <span className="text-[10px] font-semibold opacity-95">· Active</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label={`Delete ${entry.name}`}
                      className="opacity-70 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Entry Workspace */}
        {activeEntry && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Side: Bridge Setup, Links, Files, Generator */}
            <section className="lg:col-span-5 rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Skill / Journal Name
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    value={activeEntry.name}
                    onChange={(e) =>
                      onUpdateEntry(activeEntry.id, (prev) => ({
                        ...prev,
                        name: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-3 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Category
                  </label>
                  <select
                    value={activeEntry.category}
                    onChange={(e) =>
                      onUpdateEntry(activeEntry.id, (prev) => ({
                        ...prev,
                        category: e.target.value as JournalCategory,
                        updatedAt: Date.now(),
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Local Model Author
                </label>
                <select
                  value={
                    allModelNames.includes(activeEntry.model) ? activeEntry.model : ''
                  }
                  onChange={(e) =>
                    onUpdateEntry(activeEntry.id, (prev) => ({
                      ...prev,
                      model: e.target.value,
                      updatedAt: Date.now(),
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                >
                  <option value="">Select local model...</option>
                  {allModelNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Connect Side A -> Side B */}
              <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/75 dark:bg-[#16080D]/70 p-3 space-y-2">
                <div className="text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2]">
                  Side-to-Side Connection Bridge
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-11 items-center">
                  <input
                    type="text"
                    dir="auto"
                    value={activeEntry.sourceSide}
                    onChange={(e) =>
                      onUpdateEntry(activeEntry.id, (prev) => ({
                        ...prev,
                        sourceSide: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    placeholder="Side A (Source)"
                    className="sm:col-span-5 h-8 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#230D14]/80 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  />
                  <div className="sm:col-span-1 flex justify-center text-[#6B1D2F] dark:text-[#E6B8A2]">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    dir="auto"
                    value={activeEntry.targetSide}
                    onChange={(e) =>
                      onUpdateEntry(activeEntry.id, (prev) => ({
                        ...prev,
                        targetSide: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    placeholder="Side B (Target)"
                    className="sm:col-span-5 h-8 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-white/80 dark:bg-[#230D14]/80 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  />
                </div>
              </div>

              {/* Reference Links */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2]">
                  Links &amp; Connected Endpoints
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLink();
                      }
                    }}
                    placeholder="https://... or local path / model link"
                    className="h-8 flex-1 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 text-xs font-medium text-[#FAF5EC]"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Add</span>
                  </button>
                </div>
                {activeEntry.links.length > 0 && (
                  <div className="space-y-1">
                    {activeEntry.links.map((link) => (
                      <div
                        key={link}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/75 dark:bg-[#16080D]/75 px-2.5 py-1 text-[11px] font-mono"
                      >
                        <span className="truncate text-[#4D1422] dark:text-[#E6B8A2]">
                          {link}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/^https?:\/\//i.test(link) && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${link}`}
                              className="text-[#6E4A53] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateEntry(activeEntry.id, (prev) => ({
                                ...prev,
                                links: prev.links.filter((l) => l !== link),
                                updatedAt: Date.now(),
                              }))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Files + Creative Goal Prompt */}
              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Creative Instructions / Skill Prompt
                </label>
                <textarea
                  rows={4}
                  dir="auto"
                  value={activeEntry.prompt}
                  onChange={(e) =>
                    onUpdateEntry(activeEntry.id, (prev) => ({
                      ...prev,
                      prompt: e.target.value,
                      updatedAt: Date.now(),
                    }))
                  }
                  placeholder="Describe what this skill teaches other models, or creative steps linking Side A to Side B..."
                  className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                />
              </div>

              {activeEntry.attachments && activeEntry.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeEntry.attachments.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 px-2 py-1 text-[11px] font-mono"
                    >
                      <FileText className="h-3 w-3 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateEntry(activeEntry.id, (prev) => ({
                            ...prev,
                            attachments: (prev.attachments || []).filter(
                              (a) => a.id !== f.id
                            ),
                            updatedAt: Date.now(),
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleAttachFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach Any File</span>
                </button>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#4D1422] dark:bg-[#9E2A45] px-3.5 text-xs font-medium text-[#FAF5EC]"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleGenerateSkillMarkdown()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate / Refine Skill .md</span>
                  </button>
                )}
              </div>
            </section>

            {/* Right Side: Skill Markdown Editor/Preview + Attach to Project + Save */}
            <section className="lg:col-span-7 rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#230D14]/70 backdrop-blur-md p-5 flex flex-col gap-3 min-h-[440px]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-3">
                <div className="inline-flex items-center gap-1 rounded-lg bg-[#6B1D2F]/8 dark:bg-[#F3E7D8]/8 p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditMode('write')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                      editMode === 'write'
                        ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC]'
                        : 'text-[#6E4A53] dark:text-[#CEB8AE]'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Write .md</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode('preview')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      editMode === 'preview'
                        ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC]'
                        : 'text-[#6E4A53] dark:text-[#CEB8AE]'
                    }`}
                  >
                    <span>Preview</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSyncToProjectSkills}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC]"
                  >
                    {attachedToProjectTick ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {attachedToProjectTick
                        ? `Attached to ${project.name}`
                        : `Attach Skill to ${project.name}`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSaveToDesktop(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Desktop .md</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerMarkdownDownload(
                        `${activeEntry.name}.skill`,
                        buildFullSkillMarkdown(activeEntry)
                      )
                    }
                    aria-label="Download skill markdown"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 text-[#4D1422] dark:text-[#F5ECE0]"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        buildFullSkillMarkdown(activeEntry)
                      );
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label="Copy skill markdown"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 text-[#4D1422] dark:text-[#F5ECE0]"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {editMode === 'write' ? (
                <textarea
                  rows={18}
                  dir="auto"
                  value={activeEntry.markdownContent}
                  onChange={(e) =>
                    onUpdateEntry(activeEntry.id, (prev) => ({
                      ...prev,
                      markdownContent: e.target.value,
                      updatedAt: Date.now(),
                    }))
                  }
                  className="w-full flex-1 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-3.5 text-xs font-mono leading-relaxed text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                />
              ) : (
                <div dir="auto" className="flex-1 overflow-y-auto pr-1 text-sm">
                  <MarkdownRenderer content={activeEntry.markdownContent} />
                </div>
              )}

              {activeEntry.savedFilePath && (
                <div className="text-[11px] font-mono text-[#6E4A53] dark:text-[#C5AE9F]">
                  Saved file: {activeEntry.savedFilePath}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Mandatory Name Modal for Creating a New Journal / Skill Entry */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B0F17]/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#210C13] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Name New Skill / Journal Entry
              </h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-[#6E4A53] dark:text-[#CEB8AE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Skill / Journal Name (required)
                </label>
                <input
                  type="text"
                  dir="auto"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. REST API to Local SQLite Skill"
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/18 bg-white/90 dark:bg-[#16080D]/85 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(e.target.value as JournalCategory)
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/18 bg-white/90 dark:bg-[#16080D]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Local Model Author
                  </label>
                  <select
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/18 bg-white/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    <option value="">Select model...</option>
                    {allModelNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-4 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim()}
                onClick={handleConfirmCreate}
                className="h-9 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] disabled:opacity-40"
              >
                Create Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
