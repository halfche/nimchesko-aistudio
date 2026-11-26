import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileText,
  FolderCheck,
  FolderOpen,
  Layers,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ConnectionDiagnostic,
  HyperSession,
  ImportedModelProfile,
  UploadedFileAttachment,
  WorkspaceProject,
} from '../types/ollama';
import { composeSystemPrompt, streamOllamaChat } from '../services/ollamaClient';
import { readAnyUploadedFiles } from '../services/fileUploads';
import {
  HYPER_FOLDER_NAME,
  openDesktopSubfolder,
  saveMarkdownToDesktopFolder,
  triggerMarkdownDownload,
  type DesktopDirectoryHandleLike,
} from '../services/desktopFiles';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AzadiTowerMotif, PersepolisMotif } from './PersianMotifs';

interface HyperModeViewProps {
  project: WorkspaceProject;
  diagnostic: ConnectionDiagnostic;
  importedModels: ImportedModelProfile[];
  sessions: HyperSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: (session: HyperSession) => void;
  onUpdateSession: (
    id: string,
    updater: (prev: HyperSession) => HyperSession
  ) => void;
  onDeleteSession: (id: string) => void;
  desktopDirHandle: DesktopDirectoryHandleLike | null;
  onLinkDesktopFolder: () => Promise<DesktopDirectoryHandleLike | null>;
  onOpenInChat: (model: string, prompt: string, response: string, title?: string) => void;
  onOpenModels: () => void;
  onBackToChat: () => void;
}

const LANGUAGE_LABELS: Record<HyperSession['language'], string> = {
  auto: 'Auto (Match Prompt Language)',
  fa: 'Persian / فارسی',
  en: 'English',
  ar: 'Arabic / العربية',
  fr: 'French / Français',
  de: 'German / Deutsch',
  es: 'Spanish / Español',
};

function buildArchitectSystemPrompt(
  language: HyperSession['language'],
  lowerModel: string,
  sessionName: string
): string {
  const langInstruction =
    language === 'auto'
      ? 'CRITICAL LANGUAGE RULE: Write EVERY heading, explanation, rule, schema, step, and detail strictly in the exact same language as the user prompt (for example, if the prompt is in Persian/Farsi write 100% in Persian/Farsi; if English write in English).'
      : `CRITICAL LANGUAGE RULE: Write the entire Markdown specification strictly in ${LANGUAGE_LABELS[language]}.`;

  return [
    `You are the HIGHER ARCHITECT MODEL in a dual-model local execution pipeline ("Hyper Mode" — session: "${sessionName}").`,
    `Your sole job is to produce a COMPLETE, EXHAUSTIVE, ZERO-AMBIGUITY Markdown specification (.md) that will be fed directly into the LOWER BUILDER MODEL ("${lowerModel || 'local-builder'}") so the lower model can implement every piece without guessing.`,
    langInstruction,
    `Include EVERYTHING from the highest architectural overview down to the tiniest implementation detail:`,
    `1. Objective, scope, constraints, and acceptance criteria.`,
    `2. Complete folder/module structure, exact file names, and component/function boundaries.`,
    `3. Exact data structures, types, state transitions, API contracts, edge cases, and error handling.`,
    `4. Step-by-step ordered execution plan tailored specifically for "${lowerModel || 'the lower model'}" so it can produce the final code/deliverable directly.`,
    `5. If user files were attached, analyze and incorporate every relevant detail from those files into the blueprint.`,
    `Output clean, well-structured Markdown only.`,
  ].join('\n\n');
}

function buildBuilderSystemPrompt(
  language: HyperSession['language'],
  baseBrainPrompt: string,
  markdownSpec: string
): string {
  const langRule =
    language === 'auto'
      ? 'Respond and build strictly in the exact same language used in the user prompt and Markdown blueprint.'
      : `Respond strictly in ${LANGUAGE_LABELS[language]}.`;

  const sections = [
    `You are the LOWER BUILDER / EXECUTOR MODEL in Hyper Mode.`,
    langRule,
    `Follow EVERY instruction, architecture decision, schema, edge case, and tiny detail in the Higher Model Markdown Specification below.`,
  ];

  if (baseBrainPrompt.trim()) {
    sections.push(`Workspace Context:\n${baseBrainPrompt.trim()}`);
  }

  sections.push(
    `=== HIGHER MODEL MARKDOWN SPECIFICATION ===\n\n${markdownSpec.trim()}`
  );

  return sections.join('\n\n');
}

export function HyperModeView({
  project,
  diagnostic,
  importedModels,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  desktopDirHandle,
  onLinkDesktopFolder,
  onOpenInChat,
  onOpenModels,
  onBackToChat,
}: HyperModeViewProps) {
  const allModelNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of diagnostic.models) names.add(m.name);
    for (const prof of importedModels) names.add(prof.name);
    if (project.defaultModel) names.add(project.defaultModel);
    for (const em of project.enabledModels || []) names.add(em);
    return Array.from(names).filter(Boolean);
  }, [diagnostic.models, importedModels, project.defaultModel, project.enabledModels]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHigher, setNewHigher] = useState(() => allModelNames[0] || '');
  const [newLower, setNewLower] = useState(
    () => allModelNames[1] || allModelNames[0] || ''
  );
  const [newLang, setNewLang] = useState<HyperSession['language']>('auto');

  const [editingSpec, setEditingSpec] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<'spec' | 'output' | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [includeProjectBrain, setIncludeProjectBrain] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isElectron =
    typeof window !== 'undefined' && Boolean(window.nimcheskoDesktop?.isElectron);

  const handleOpenCreateModal = () => {
    setNewName('');
    setNewHigher(activeSession?.higherModel || allModelNames[0] || '');
    setNewLower(
      activeSession?.lowerModel || allModelNames[1] || allModelNames[0] || ''
    );
    setNewLang(activeSession?.language || 'auto');
    setShowNewModal(true);
  };

  const handleConfirmCreateSession = () => {
    const clean = newName.trim();
    if (!clean) return;
    const now = Date.now();
    const created: HyperSession = {
      id: `hyper-${now}-${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      higherModel: newHigher || allModelNames[0] || '',
      lowerModel: newLower || allModelNames[1] || allModelNames[0] || '',
      language: newLang,
      taskPrompt: '',
      attachments: [],
      markdownSpec: '',
      lowerOutput: '',
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    onCreateSession(created);
    setShowNewModal(false);
  };

  const handleAttachFiles = async (fileList: FileList | null) => {
    if (!activeSession || !fileList || fileList.length === 0) return;
    const uploaded = await readAnyUploadedFiles(fileList);
    if (uploaded.length === 0) return;
    onUpdateSession(activeSession.id, (prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...uploaded],
      updatedAt: Date.now(),
    }));
  };

  const handleRemoveAttachment = (fileId: string) => {
    if (!activeSession) return;
    onUpdateSession(activeSession.id, (prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((f) => f.id !== fileId),
      updatedAt: Date.now(),
    }));
  };

  const persistMarkdownToDesktop = async (
    session: HyperSession,
    markdownContent: string,
    allowBrowserDownload = false
  ) => {
    if (!markdownContent.trim()) return;
    const fullDoc = [
      `# ${session.name}`,
      '',
      `> **Hyper Mode Session** · Higher Model: \`${session.higherModel}\` -> Lower Model: \`${session.lowerModel}\` · Language: \`${session.language}\``,
      '',
      markdownContent.trim(),
      '',
    ].join('\n');

    const res = await saveMarkdownToDesktopFolder({
      folderName: HYPER_FOLDER_NAME,
      fileName: session.name,
      content: fullDoc,
      desktopDirHandle,
      fallbackDownload: allowBrowserDownload,
    });

    if (res.ok) {
      onUpdateSession(session.id, (prev) => ({
        ...prev,
        savedFilePath: res.savedPath,
        savedMethod: res.method,
        updatedAt: Date.now(),
      }));
      setSaveFeedback(`Saved to ${res.savedPath}`);
    } else if (res.error) {
      setSaveFeedback(`Auto-saved in workspace · Link Desktop folder to write directly to ~/Desktop/${HYPER_FOLDER_NAME}`);
    }
  };

  const runLowerModelOnly = async (
    sessionSnapshot: HyperSession,
    specText: string,
    signal: AbortSignal
  ) => {
    if (!sessionSnapshot.lowerModel.trim()) {
      throw new Error('Select a Lower / Builder Model before running execution.');
    }

    onUpdateSession(sessionSnapshot.id, (prev) => ({
      ...prev,
      status: 'executing',
      lowerOutput: '',
      lowerThinking: '',
      error: undefined,
      updatedAt: Date.now(),
    }));

    const baseBrain = includeProjectBrain
      ? composeSystemPrompt('', project.skills, {
          projectName: project.name,
          brainPrompt: project.brainPrompt,
          rulesMarkdown: project.rulesMarkdown,
          rulesEnabled: project.rulesEnabled,
          contextItems: project.contextItems,
          envVars: project.envVars,
        })
      : '';

    const builderMsg: ChatMessage = {
      id: `hyper-l-${Date.now()}`,
      role: 'user',
      content: [
        `Execute and build everything described in the Higher Model specification for task "${sessionSnapshot.name}".`,
        sessionSnapshot.taskPrompt.trim()
          ? `Original User Prompt:\n${sessionSnapshot.taskPrompt.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      files: sessionSnapshot.attachments,
      createdAt: Date.now(),
    };

    await streamOllamaChat({
      baseUrl: project.baseUrl,
      model: sessionSnapshot.lowerModel,
      systemPrompt: buildBuilderSystemPrompt(
        sessionSnapshot.language,
        baseBrain,
        specText
      ),
      messages: [builderMsg],
      params: { ...project.params, toolsEnabled: false },
      signal,
      onChunk: ({ content, thinking }) => {
        onUpdateSession(sessionSnapshot.id, (prev) => ({
          ...prev,
          lowerOutput: content,
          lowerThinking: thinking,
          updatedAt: Date.now(),
        }));
      },
      onComplete: () => {
        onUpdateSession(sessionSnapshot.id, (prev) => ({
          ...prev,
          status: 'done',
          updatedAt: Date.now(),
        }));
      },
    });
  };

  const handleRunFullPipeline = async () => {
    if (!activeSession || isRunning) return;
    if (!activeSession.name.trim()) {
      setSaveFeedback('Please name this Hyper Mode session before running.');
      return;
    }
    if (!activeSession.higherModel.trim() || !activeSession.lowerModel.trim()) {
      setSaveFeedback('Select both a Higher Model and a Lower Model.');
      return;
    }
    if (
      !activeSession.taskPrompt.trim() &&
      (!activeSession.attachments || activeSession.attachments.length === 0)
    ) {
      setSaveFeedback('Enter a task prompt or attach local files to run Hyper Mode.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setSaveFeedback(null);

    const sessionId = activeSession.id;
    let capturedSpec = '';

    try {
      onUpdateSession(sessionId, (prev) => ({
        ...prev,
        status: 'architecting',
        markdownSpec: '',
        lowerOutput: '',
        higherThinking: '',
        lowerThinking: '',
        error: undefined,
        updatedAt: Date.now(),
      }));

      const architectUserMsg: ChatMessage = {
        id: `hyper-h-${Date.now()}`,
        role: 'user',
        content: activeSession.taskPrompt.trim() || 'Analyze attached files and create full specification.',
        files: activeSession.attachments,
        createdAt: Date.now(),
      };

      const projectContextPrefix = includeProjectBrain
        ? composeSystemPrompt('', project.skills, {
            projectName: project.name,
            brainPrompt: project.brainPrompt,
            rulesMarkdown: project.rulesMarkdown,
            rulesEnabled: project.rulesEnabled,
            contextItems: project.contextItems,
            envVars: project.envVars,
          })
        : '';

      const architectSys = [
        buildArchitectSystemPrompt(
          activeSession.language,
          activeSession.lowerModel,
          activeSession.name
        ),
        projectContextPrefix,
      ]
        .filter(Boolean)
        .join('\n\n---\n\n');

      await streamOllamaChat({
        baseUrl: project.baseUrl,
        model: activeSession.higherModel,
        systemPrompt: architectSys,
        messages: [architectUserMsg],
        params: { ...project.params, toolsEnabled: false },
        signal: controller.signal,
        onChunk: ({ content, thinking }) => {
          capturedSpec = content;
          onUpdateSession(sessionId, (prev) => ({
            ...prev,
            markdownSpec: content,
            higherThinking: thinking,
            updatedAt: Date.now(),
          }));
        },
        onComplete: () => {
          // Proceed immediately to saving .md + invoking Lower Model
        },
      });

      if (controller.signal.aborted) return;

      // Save the generated Markdown specification to Desktop/Hyper Mode Markdown Files
      await persistMarkdownToDesktop(activeSession, capturedSpec, false);

      // Hand the full Markdown file to the Lower Model
      await runLowerModelOnly(activeSession, capturedSpec, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onUpdateSession(sessionId, (prev) => ({
          ...prev,
          status: 'idle',
          updatedAt: Date.now(),
        }));
        return;
      }
      const msg = err instanceof Error ? err.message : 'Hyper Mode pipeline failed.';
      onUpdateSession(sessionId, (prev) => ({
        ...prev,
        status: 'error',
        error: msg,
        updatedAt: Date.now(),
      }));
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleRerunLowerOnly = async () => {
    if (!activeSession || isRunning || !activeSession.markdownSpec.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setSaveFeedback(null);
    try {
      await persistMarkdownToDesktop(activeSession, activeSession.markdownSpec, false);
      await runLowerModelOnly(activeSession, activeSession.markdownSpec, controller.signal);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const msg = err instanceof Error ? err.message : 'Lower model execution failed.';
        onUpdateSession(activeSession.id, (prev) => ({
          ...prev,
          status: 'error',
          error: msg,
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleCopy = async (key: 'spec' | 'output', text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <PersepolisMotif className="h-10 w-12" />
              <AzadiTowerMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                Dual-Model Architect -&gt; Builder Pipeline
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Hyper Mode
              </h1>
              <p className="mt-1.5 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Select a <strong>Higher Architect Model</strong> and a <strong>Lower Builder Model</strong>. The higher model converts your request (Persian, English, or any language) and files into a complete Markdown blueprint saved in{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14">
                  Desktop/{HYPER_FOLDER_NAME}
                </code>
                , then passes it to the lower model for implementation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isElectron && (
              <button
                type="button"
                onClick={() => void onLinkDesktopFolder()}
                title={`Link your Desktop directory so Hyper Mode auto-creates ${HYPER_FOLDER_NAME}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
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
                onClick={() => void openDesktopSubfolder(HYPER_FOLDER_NAME)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Open Desktop Folder</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Hyper Session</span>
            </button>

            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        {/* Named Hyper Sessions Selector */}
        <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
              <Layers className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
              <span>Named Hyper Sessions ({sessions.length})</span>
            </div>
            {saveFeedback && (
              <span className="text-xs font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">
                {saveFeedback}
              </span>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#6B1D2F]/22 dark:border-[#F3E7D8]/20 p-5 text-center space-y-2">
              <p className="text-sm font-medium text-[#3A101B] dark:text-[#F5ECE0]">
                Create and name a Hyper Mode session to start
              </p>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                Every Hyper session gets a required name, two local models, and a dedicated Markdown blueprint saved to Desktop/{HYPER_FOLDER_NAME}.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Name &amp; Create First Session</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => {
                const isActive = s.id === activeSession?.id;
                const isRenaming = renamingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'border-[#6B1D2F]/50 dark:border-[#E6B8A2]/50 bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                        : 'border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 text-[#3A101B] dark:text-[#F5ECE0]'
                    }`}
                  >
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (renameValue.trim()) {
                            onUpdateSession(s.id, (prev) => ({
                              ...prev,
                              name: renameValue.trim(),
                              updatedAt: Date.now(),
                            }));
                          }
                          setRenamingId(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="h-6 w-36 rounded bg-white/90 px-1.5 text-xs text-[#2B0F17] focus:outline-none"
                        />
                        <button type="submit" className="p-0.5">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectSession(s.id)}
                          className="font-medium truncate max-w-[180px]"
                        >
                          {s.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(s.id);
                            setRenameValue(s.name);
                          }}
                          aria-label={`Rename ${s.name}`}
                          className="opacity-70 hover:opacity-100 p-0.5"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isRunning && isActive}
                          onClick={() => onDeleteSession(s.id)}
                          aria-label={`Delete ${s.name}`}
                          className="opacity-70 hover:opacity-100 p-0.5 disabled:opacity-30"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Session Config & Prompt */}
        {activeSession && (
          <>
            <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/70 dark:bg-[#230D14]/65 backdrop-blur-md p-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Higher Model (Architect · Writes .md Spec)
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={
                        allModelNames.includes(activeSession.higherModel)
                          ? activeSession.higherModel
                          : ''
                      }
                      onChange={(e) =>
                        onUpdateSession(activeSession.id, (prev) => ({
                          ...prev,
                          higherModel: e.target.value,
                          updatedAt: Date.now(),
                        }))
                      }
                      className="h-9 flex-1 min-w-0 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                    >
                      <option value="">Select higher model...</option>
                      {allModelNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="hidden md:flex md:col-span-1 items-end justify-center pb-2 text-[#6B1D2F] dark:text-[#E6B8A2]">
                  <ArrowRight className="h-4 w-4" />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Lower Model (Builder · Executes Spec)
                  </label>
                  <select
                    value={
                      allModelNames.includes(activeSession.lowerModel)
                        ? activeSession.lowerModel
                        : ''
                    }
                    onChange={(e) =>
                      onUpdateSession(activeSession.id, (prev) => ({
                        ...prev,
                        lowerModel: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    <option value="">Select lower model...</option>
                    {allModelNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Blueprint Language
                  </label>
                  <select
                    value={activeSession.language}
                    onChange={(e) =>
                      onUpdateSession(activeSession.id, (prev) => ({
                        ...prev,
                        language: e.target.value as HyperSession['language'],
                        updatedAt: Date.now(),
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                  >
                    {Object.entries(LANGUAGE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {allModelNames.length === 0 && (
                <div className="rounded-xl border border-[#6B1D2F]/20 dark:border-[#E6B8A2]/25 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#4D1422] dark:text-[#E6B8A2]">
                    No local models detected yet. Connect Ollama or import local model files first.
                  </span>
                  <button
                    type="button"
                    onClick={onOpenModels}
                    className="rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-3 py-1 text-xs font-medium text-[#FAF5EC] shrink-0"
                  >
                    Add Local Models
                  </button>
                </div>
              )}

              {/* Attached files of ANY type */}
              {activeSession.attachments && activeSession.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeSession.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/18 bg-[#FCF8F2]/90 dark:bg-[#16080D]/80 px-2.5 py-1.5 text-xs text-[#3A101B] dark:text-[#F5ECE0]"
                    >
                      {file.kind === 'image' && file.dataUrl ? (
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                      )}
                      <span className="font-mono max-w-[160px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="text-[#6E4A53] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Task Request for Hyper Mode (Session: {activeSession.name})
                </label>
                <textarea
                  rows={4}
                  dir="auto"
                  value={activeSession.taskPrompt}
                  onChange={(e) =>
                    onUpdateSession(activeSession.id, (prev) => ({
                      ...prev,
                      taskPrompt: e.target.value,
                      updatedAt: Date.now(),
                    }))
                  }
                  placeholder="Describe what you want built in Persian, English, or any language — Higher Model will write the complete Markdown blueprint and hand it to Lower Model..."
                  className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#4D1422] dark:text-[#E6B8A2]">
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
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#16080D]/85 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2]"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Upload Any File</span>
                  </button>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeProjectBrain}
                      onChange={(e) => setIncludeProjectBrain(e.target.checked)}
                      className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                    />
                    <span>Include Project Brain &amp; Skills</span>
                  </label>

                  {activeSession.savedFilePath && (
                    <span className="font-mono text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                      Saved: {activeSession.savedFilePath}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeSession.markdownSpec.trim() && !isRunning && (
                    <button
                      type="button"
                      onClick={() => void handleRerunLowerOnly()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#16080D]/85 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Re-run Lower Model Only</span>
                    </button>
                  )}

                  {isRunning ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#4D1422] dark:bg-[#9E2A45] px-4 text-xs font-medium text-[#FAF5EC]"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>
                        {activeSession.status === 'architecting'
                          ? 'Stop Architect'
                          : 'Stop Builder'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRunFullPipeline()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Run Higher -&gt; Lower Pipeline</span>
                    </button>
                  )}
                </div>
              </div>

              {activeSession.error && (
                <div className="rounded-xl border border-[#9E1B32]/35 bg-[#9E1B32]/10 px-3.5 py-2.5 text-xs text-[#7A1326] dark:text-[#FBC2CB]">
                  {activeSession.error}
                </div>
              )}
            </section>

            {/* Dual Output Columns: Higher Markdown Blueprint + Lower Execution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Higher Model Markdown Spec */}
              <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#230D14]/70 backdrop-blur-md p-5 flex flex-col gap-3 min-h-[360px]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-3">
                  <div>
                    <div className="text-[11px] font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">
                      Stage 1 · Higher Model ({activeSession.higherModel || 'unset'})
                    </div>
                    <h2 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      Generated Markdown Blueprint (.md)
                      {activeSession.status === 'architecting' ? ' · Streaming...' : ''}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingSpec((v) => !v)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>{editingSpec ? 'Preview' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!activeSession.markdownSpec.trim()}
                      onClick={() =>
                        void persistMarkdownToDesktop(
                          activeSession,
                          activeSession.markdownSpec,
                          true
                        )
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] disabled:opacity-40"
                    >
                      <Save className="h-3 w-3" />
                      <span>Save .md</span>
                    </button>
                    <button
                      type="button"
                      disabled={!activeSession.markdownSpec.trim()}
                      onClick={() =>
                        triggerMarkdownDownload(
                          activeSession.name,
                          activeSession.markdownSpec
                        )
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] disabled:opacity-40"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!activeSession.markdownSpec.trim()}
                      onClick={() =>
                        void handleCopy('spec', activeSession.markdownSpec)
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] disabled:opacity-40"
                    >
                      {copiedKey === 'spec' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                {editingSpec ? (
                  <textarea
                    rows={16}
                    dir="auto"
                    value={activeSession.markdownSpec}
                    onChange={(e) =>
                      onUpdateSession(activeSession.id, (prev) => ({
                        ...prev,
                        markdownSpec: e.target.value,
                        updatedAt: Date.now(),
                      }))
                    }
                    className="w-full flex-1 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-3 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                  />
                ) : activeSession.markdownSpec ? (
                  <div dir="auto" className="flex-1 overflow-y-auto pr-1 text-sm">
                    <MarkdownRenderer content={activeSession.markdownSpec} />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-[#6E4A53] dark:text-[#CEB8AE] text-center p-6">
                    Run Hyper Mode to have the Higher Model produce an exhaustive Markdown blueprint and save it automatically to Desktop/{HYPER_FOLDER_NAME}.
                  </div>
                )}
              </section>

              {/* Lower Model Builder Execution Output */}
              <section className="rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#230D14]/70 backdrop-blur-md p-5 flex flex-col gap-3 min-h-[360px]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pb-3">
                  <div>
                    <div className="text-[11px] font-mono text-[#6B1D2F] dark:text-[#E6B8A2]">
                      Stage 2 · Lower Model ({activeSession.lowerModel || 'unset'})
                    </div>
                    <h2 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                      Lower Model Execution Output
                      {activeSession.status === 'executing' ? ' · Building...' : ''}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!activeSession.lowerOutput.trim()}
                      onClick={() =>
                        void handleCopy('output', activeSession.lowerOutput)
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 px-2 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0] disabled:opacity-40"
                    >
                      {copiedKey === 'output' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'output' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!activeSession.lowerOutput.trim()}
                      onClick={() =>
                        onOpenInChat(
                          activeSession.lowerModel || activeSession.higherModel,
                          activeSession.taskPrompt || activeSession.name,
                          activeSession.lowerOutput,
                          activeSession.name
                        )
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 text-[11px] font-medium text-[#FAF5EC] disabled:opacity-40"
                    >
                      <MessageSquarePlus className="h-3 w-3" />
                      <span>Open in Chat</span>
                    </button>
                  </div>
                </div>

                {activeSession.lowerOutput ? (
                  <div dir="auto" className="flex-1 overflow-y-auto pr-1 text-sm">
                    <MarkdownRenderer content={activeSession.lowerOutput} />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-[#6E4A53] dark:text-[#CEB8AE] text-center p-6">
                    {activeSession.status === 'architecting'
                      ? 'Higher Model is finishing the Markdown blueprint — Lower Model will start automatically right after.'
                      : 'Lower Model output will stream here using the Higher Model Markdown specification.'}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {/* Mandatory Name Modal for Creating a New Hyper Session */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B0F17]/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#210C13] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Name New Hyper Mode Session
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
                  Session Name (required — also used for saved .md filename)
                </label>
                <input
                  type="text"
                  dir="auto"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Persian Invoice App Spec"
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/18 bg-white/90 dark:bg-[#16080D]/85 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Higher Architect Model
                  </label>
                  <select
                    value={newHigher}
                    onChange={(e) => setNewHigher(e.target.value)}
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

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Lower Builder Model
                  </label>
                  <select
                    value={newLower}
                    onChange={(e) => setNewLower(e.target.value)}
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

              <div>
                <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                  Blueprint Language
                </label>
                <select
                  value={newLang}
                  onChange={(e) =>
                    setNewLang(e.target.value as HyperSession['language'])
                  }
                  className="h-9 w-full rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/18 bg-white/90 dark:bg-[#16080D]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                >
                  {Object.entries(LANGUAGE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
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
                onClick={handleConfirmCreateSession}
                className="h-9 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] disabled:opacity-40"
              >
                Create Hyper Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
