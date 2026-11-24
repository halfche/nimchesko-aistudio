import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Menu,
  Moon,
  Plus,
  Save,
  Search,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import { ProjectMotifIcon, ShamsehEmblem } from './components/PersianMotifs';
import type {
  ChatAttachment,
  ChatMessage,
  ConnectionDiagnostic,
  Conversation,
  ImportedModelProfile,
  ModelParameters,
  MotifId,
  OllamaToolCall,
  PromptKind,
  SkillModule,
  SystemConnector,
  WorkspaceProject,
  WorkspaceSyncBundle,
} from './types/ollama';
import {
  buildOllamaToolsSchema,
  composeSystemPrompt,
  executeSystemConnector,
  probeOllamaConnection,
  streamOllamaChat,
} from './services/ollamaClient';
import {
  DEFAULT_MODEL_PARAMS,
  createConversation,
  createInitialProjects,
  createWorkspaceProject,
} from './data/presets';
import { ChatView } from './components/ChatView';
import { IntegrationGuide } from './components/IntegrationGuide';
import { SkillsAndConnectorsView } from './components/SkillsAndConnectorsView';
import { ProjectsView } from './components/ProjectsView';
import { QuickPromptsSidebarSection } from './components/QuickPromptsSidebarSection';
import { ConversationFoldersSidebar } from './components/ConversationFoldersSidebar';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ModelsAndSyncView } from './components/ModelsAndSyncView';
import {
  buildWorkspaceSyncBundle,
  mergeWorkspaceSyncBundle,
} from './services/workspaceSync';

const STORAGE_PROJECTS_KEY = 'gemma_studio_projects_v2';
const STORAGE_ACTIVE_PROJECT_KEY = 'gemma_studio_active_project_v2';
const STORAGE_THEME_KEY = 'gemma_studio_theme_v1';
const STORAGE_CONTEXT_MONITOR_KEY = 'gemma_studio_context_monitor_v1';
const STORAGE_AUTOSAVE_KEY = 'gemma_studio_autosave_v1';
const STORAGE_DRAFTS_KEY = 'gemma_studio_drafts_v1';
const STORAGE_IMPORTED_MODELS_KEY = 'gemma_studio_imported_models_v1';

// Legacy v1 keys for smooth one-time migration
const LEGACY_CONVERSATIONS_KEY = 'gemma_studio_conversations_v1';
const LEGACY_BASE_URL_KEY = 'gemma_studio_ollama_url_v1';
const LEGACY_PARAMS_KEY = 'gemma_studio_params_v1';
const LEGACY_SKILLS_KEY = 'gemma_studio_skills_v1';
const LEGACY_CONNECTORS_KEY = 'gemma_studio_connectors_v1';

function loadInitialProjects(): WorkspaceProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceProject[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((proj) => ({
          ...proj,
          conversations:
            Array.isArray(proj.conversations) && proj.conversations.length > 0
              ? proj.conversations
              : [createConversation(proj.defaultModel || 'gemma4:12b')],
          folders: Array.isArray(proj.folders) ? proj.folders : [],
          contextItems: Array.isArray(proj.contextItems) ? proj.contextItems : [],
          prompts: Array.isArray(proj.prompts) ? proj.prompts : [],
          rulesMarkdown: typeof proj.rulesMarkdown === 'string' ? proj.rulesMarkdown : '',
          rulesEnabled: proj.rulesEnabled ?? true,
          envVars: Array.isArray(proj.envVars) ? proj.envVars : [],
          skills: Array.isArray(proj.skills) ? proj.skills : [],
          connectors: Array.isArray(proj.connectors) ? proj.connectors : [],
          params: { ...DEFAULT_MODEL_PARAMS, ...(proj.params || {}) },
        }));
      }
    }
  } catch {
    // Ignore corrupt storage
  }

  const starterProjects = createInitialProjects();

  // Migrate any legacy v1 workspace state into the first starter project
  try {
    const legacyConvsRaw = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
    if (legacyConvsRaw) {
      const legacyConvs = JSON.parse(legacyConvsRaw) as Conversation[];
      if (Array.isArray(legacyConvs) && legacyConvs.length > 0) {
        starterProjects[0].conversations = legacyConvs;
        starterProjects[0].activeConversationId = legacyConvs[0].id;
      }
    }
    const legacyUrl = localStorage.getItem(LEGACY_BASE_URL_KEY);
    if (legacyUrl) starterProjects[0].baseUrl = legacyUrl;

    const legacyParamsRaw = localStorage.getItem(LEGACY_PARAMS_KEY);
    if (legacyParamsRaw) {
      starterProjects[0].params = {
        ...DEFAULT_MODEL_PARAMS,
        ...(JSON.parse(legacyParamsRaw) as Partial<ModelParameters>),
      };
    }
    const legacySkillsRaw = localStorage.getItem(LEGACY_SKILLS_KEY);
    if (legacySkillsRaw) {
      const parsedSkills = JSON.parse(legacySkillsRaw) as SkillModule[];
      if (Array.isArray(parsedSkills) && parsedSkills.length > 0) {
        starterProjects[0].skills = parsedSkills;
      }
    }
    const legacyConnectorsRaw = localStorage.getItem(LEGACY_CONNECTORS_KEY);
    if (legacyConnectorsRaw) {
      const parsedConnectors = JSON.parse(legacyConnectorsRaw) as SystemConnector[];
      if (Array.isArray(parsedConnectors) && parsedConnectors.length > 0) {
        starterProjects[0].connectors = parsedConnectors;
      }
    }
  } catch {
    // Ignore legacy migration errors
  }

  return starterProjects;
}

function loadInitialDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.length > 0) clean[k] = v;
        }
        return clean;
      }
    }
  } catch {
    // Ignore corrupt drafts
  }
  return {};
}

function loadInitialImportedModels(): ImportedModelProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_IMPORTED_MODELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ImportedModelProfile[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore corrupt models list
  }
  return [];
}

interface SyncFileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export default function App() {
  const [projects, setProjects] = useState<WorkspaceProject[]>(loadInitialProjects);
  const [importedModels, setImportedModels] = useState<ImportedModelProfile[]>(
    loadInitialImportedModels
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(loadInitialDrafts);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_ACTIVE_PROJECT_KEY) || '';
  });

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_AUTOSAVE_KEY);
    return saved === null ? true : saved === 'true';
  });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'paused'>(() => {
    const saved = localStorage.getItem(STORAGE_AUTOSAVE_KEY);
    return saved === 'false' ? 'paused' : 'saved';
  });
  const [lastSavedAt, setLastSavedAt] = useState<number>(() => Date.now());
  const [linkedSyncFileName, setLinkedSyncFileName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncFileHandleRef = useRef<SyncFileHandleLike | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [contextMonitorMode, setContextMonitorMode] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_CONTEXT_MONITOR_KEY) === 'true';
  });

  const [activeTab, setActiveTab] = useState<
    'chat' | 'projects' | 'models' | 'skills' | 'guide'
  >('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<{ id: number; text: string } | null>(null);
  const [composerFocusTick, setComposerFocusTick] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [diagnostic, setDiagnostic] = useState<ConnectionDiagnostic>({
    status: 'idle',
    models: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const probeControllerRef = useRef<AbortController | null>(null);

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  const activeConversation = useMemo(() => {
    if (!activeProject) return undefined;
    return (
      activeProject.conversations.find(
        (c) => c.id === activeProject.activeConversationId
      ) || activeProject.conversations[0]
    );
  }, [activeProject]);

  useEffect(() => {
    if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
      if (projects[0]) {
        setActiveProjectId(projects[0].id);
      }
    }
  }, [activeProjectId, projects]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_CONTEXT_MONITOR_KEY,
      contextMonitorMode ? 'true' : 'false'
    );
  }, [contextMonitorMode]);

  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const importedModelsRef = useRef(importedModels);
  importedModelsRef.current = importedModels;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const autoSaveRef = useRef(autoSaveEnabled);
  autoSaveRef.current = autoSaveEnabled;

  const mirrorToLinkedSyncFile = useCallback(
    async (
      nextProjects: WorkspaceProject[],
      nextModels: ImportedModelProfile[],
      nextDrafts: Record<string, string>
    ) => {
      const handle = syncFileHandleRef.current;
      if (!handle) return;
      try {
        const bundle = buildWorkspaceSyncBundle(
          nextProjects,
          nextModels,
          nextDrafts
        );
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(bundle, null, 2));
        await writable.close();
        setLastSyncedAt(Date.now());
      } catch {
        // Ignore transient write permission errors
      }
    },
    []
  );

  const persistWorkspaceNow = useCallback(
    (
      nextProjects = projectsRef.current,
      nextDrafts = draftsRef.current,
      nextModels = importedModelsRef.current
    ) => {
      try {
        localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(nextProjects));
      } catch {
        try {
          const stripped = nextProjects.map((p) => ({
            ...p,
            conversations: p.conversations.map((c) => ({
              ...c,
              messages: c.messages.map((m) => ({ ...m, images: undefined })),
            })),
          }));
          localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(stripped));
        } catch {
          // Ignore storage failure
        }
      }
      try {
        localStorage.setItem(STORAGE_DRAFTS_KEY, JSON.stringify(nextDrafts));
      } catch {
        // Ignore storage failure
      }
      try {
        localStorage.setItem(
          STORAGE_IMPORTED_MODELS_KEY,
          JSON.stringify(nextModels)
        );
      } catch {
        // Ignore storage failure
      }
      void mirrorToLinkedSyncFile(nextProjects, nextModels, nextDrafts);
      setLastSavedAt(Date.now());
      setSaveStatus('saved');
    },
    [mirrorToLinkedSyncFile]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_AUTOSAVE_KEY, autoSaveEnabled ? 'true' : 'false');
    if (autoSaveEnabled) {
      persistWorkspaceNow(
        projectsRef.current,
        draftsRef.current,
        importedModelsRef.current
      );
    } else {
      setSaveStatus('paused');
    }
  }, [autoSaveEnabled, persistWorkspaceNow]);

  useEffect(() => {
    if (!autoSaveEnabled) {
      setSaveStatus('paused');
      return;
    }
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      persistWorkspaceNow(projects, drafts, importedModels);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projects, drafts, importedModels, autoSaveEnabled, persistWorkspaceNow]);

  useEffect(() => {
    const flushIfEnabled = () => {
      if (autoSaveRef.current) {
        persistWorkspaceNow(
          projectsRef.current,
          draftsRef.current,
          importedModelsRef.current
        );
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushIfEnabled();
      }
    };
    window.addEventListener('beforeunload', flushIfEnabled);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushIfEnabled);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [persistWorkspaceNow]);

  useEffect(() => {
    if (activeProject) {
      localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, activeProject.id);
    }
  }, [activeProject]);

  const activeBaseUrl = activeProject?.baseUrl || 'http://localhost:11434';

  const runProbe = useCallback(async () => {
    probeControllerRef.current?.abort();
    const controller = new AbortController();
    probeControllerRef.current = controller;

    setDiagnostic((prev) => ({ ...prev, status: 'checking' }));
    try {
      const result = await probeOllamaConnection(activeBaseUrl, controller.signal);
      setDiagnostic(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }, [activeBaseUrl]);

  useEffect(() => {
    void runProbe();
    return () => {
      probeControllerRef.current?.abort();
      abortControllerRef.current?.abort();
    };
  }, [runProbe]);

  const updateProject = useCallback(
    (projectId: string, updater: (prev: WorkspaceProject) => WorkspaceProject) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updater(p) : p))
      );
    },
    []
  );

  const updateActiveProject = useCallback(
    (updater: (prev: WorkspaceProject) => WorkspaceProject) => {
      if (!activeProject) return;
      updateProject(activeProject.id, updater);
    },
    [activeProject, updateProject]
  );

  const updateConversation = useCallback(
    (
      projectId: string,
      convId: string,
      updater: (prev: Conversation) => Conversation
    ) => {
      updateProject(projectId, (proj) => ({
        ...proj,
        updatedAt: Date.now(),
        conversations: proj.conversations.map((c) =>
          c.id === convId ? updater(c) : c
        ),
      }));
    },
    [updateProject]
  );

  const handleSelectProject = (projectId: string) => {
    if (projectId === activeProject?.id) {
      setProjectMenuOpen(false);
      return;
    }
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setActiveProjectId(projectId);
    setProjectMenuOpen(false);
    setSearchQuery('');
  };

  const handleCreateProject = (input: {
    name: string;
    description: string;
    motif: MotifId;
    defaultModel: string;
    brainPrompt: string;
  }) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const created = createWorkspaceProject({
      name: input.name,
      description: input.description,
      motif: input.motif,
      defaultModel: input.defaultModel,
      brainPrompt: input.brainPrompt,
    });
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setSearchQuery('');
    setProjectMenuOpen(false);
  };

  const handleDuplicateProject = (projectId: string) => {
    const source = projects.find((p) => p.id === projectId);
    if (!source) return;
    const freshChat = createConversation(source.defaultModel);
    const cloned: WorkspaceProject = {
      ...source,
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${source.name} Copy`,
      skills: source.skills.map((s) => ({ ...s })),
      connectors: source.connectors.map((c) => ({
        ...c,
        parameters: c.parameters.map((p) => ({ ...p })),
      })),
      contextItems: source.contextItems.map((ctx) => ({
        ...ctx,
        id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      })),
      prompts: source.prompts.map((pr) => ({
        ...pr,
        id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      })),
      envVars: source.envVars.map((env) => ({
        ...env,
        id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      })),
      folders: [],
      conversations: [freshChat],
      activeConversationId: freshChat.id,
      updatedAt: Date.now(),
    };
    setProjects((prev) => [cloned, ...prev]);
    setActiveProjectId(cloned.id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;
    if (isStreaming && activeProject?.id === projectId) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== projectId);
      if (activeProjectId === projectId && remaining[0]) {
        setActiveProjectId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleNewChat = () => {
    if (!activeProject) return;
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const next = createConversation(
      activeConversation?.model || activeProject.defaultModel || 'gemma4:12b'
    );
    updateActiveProject((proj) => ({
      ...proj,
      conversations: [next, ...proj.conversations],
      activeConversationId: next.id,
      updatedAt: Date.now(),
    }));
    setActiveTab('chat');
    setSidebarOpen(false);
    setComposerFocusTick((t) => t + 1);
  };

  const handleClearChat = () => {
    if (!activeProject || !activeConversation) return;
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    updateConversation(activeProject.id, activeConversation.id, (conv) => ({
      ...conv,
      title: 'New chat',
      messages: [],
      updatedAt: Date.now(),
    }));
    setDrafts((prev) => {
      if (!prev[activeConversation.id]) return prev;
      const next = { ...prev };
      delete next[activeConversation.id];
      return next;
    });
    setActiveTab('chat');
    setSidebarOpen(false);
    setComposerFocusTick((t) => t + 1);
  };

  const newChatRef = useRef(handleNewChat);
  newChatRef.current = handleNewChat;
  const clearChatRef = useRef(handleClearChat);
  clearChatRef.current = handleClearChat;

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        clearChatRef.current();
      } else if (key === 'n') {
        e.preventDefault();
        newChatRef.current();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const handleDeleteConversation = (convId: string) => {
    if (!activeProject) return;
    if (isStreaming && activeConversation?.id === convId) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setDrafts((prev) => {
      if (!prev[convId]) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    updateActiveProject((proj) => {
      const filtered = proj.conversations.filter((c) => c.id !== convId);
      if (filtered.length === 0) {
        const fresh = createConversation(proj.defaultModel || 'gemma4:12b');
        return {
          ...proj,
          conversations: [fresh],
          activeConversationId: fresh.id,
          updatedAt: Date.now(),
        };
      }
      return {
        ...proj,
        conversations: filtered,
        activeConversationId:
          proj.activeConversationId === convId
            ? filtered[0].id
            : proj.activeConversationId,
        updatedAt: Date.now(),
      };
    });
  };

  const runAssistantGeneration = async (
    projectSnapshot: WorkspaceProject,
    convId: string,
    model: string,
    threadSystemPrompt: string,
    historyMessages: ChatMessage[],
    initialAssistantMsgId: string
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    const effectiveSystemPrompt = composeSystemPrompt(
      threadSystemPrompt,
      projectSnapshot.skills,
      {
        projectName: projectSnapshot.name,
        brainPrompt: projectSnapshot.brainPrompt,
        rulesMarkdown: projectSnapshot.rulesMarkdown,
        rulesEnabled: projectSnapshot.rulesEnabled,
        contextItems: projectSnapshot.contextItems,
        envVars: projectSnapshot.envVars,
      }
    );
    const activeTools = projectSnapshot.params.toolsEnabled
      ? buildOllamaToolsSchema(projectSnapshot.connectors)
      : [];

    let workingHistory = [...historyMessages];
    let currentAssistantId = initialAssistantMsgId;
    const maxToolRounds = 5;

    try {
      for (let round = 0; round < maxToolRounds; round++) {
        let roundContent = '';
        let roundThinking = '';
        let roundToolCalls: OllamaToolCall[] | undefined;

        await streamOllamaChat({
          baseUrl: projectSnapshot.baseUrl,
          model,
          systemPrompt: effectiveSystemPrompt,
          messages: workingHistory,
          params: projectSnapshot.params,
          tools: activeTools,
          signal: controller.signal,
          onChunk: ({ content, thinking, toolCalls }) => {
            roundContent = content;
            roundThinking = thinking;
            if (toolCalls) roundToolCalls = toolCalls;
            updateConversation(projectSnapshot.id, convId, (conv) => ({
              ...conv,
              updatedAt: Date.now(),
              messages: conv.messages.map((m) =>
                m.id === currentAssistantId
                  ? { ...m, content, thinking, toolCalls }
                  : m
              ),
            }));
          },
          onComplete: ({ metrics, toolCalls }) => {
            if (toolCalls) roundToolCalls = toolCalls;
            updateConversation(projectSnapshot.id, convId, (conv) => ({
              ...conv,
              updatedAt: Date.now(),
              messages: conv.messages.map((m) =>
                m.id === currentAssistantId ? { ...m, metrics, toolCalls } : m
              ),
            }));
          },
        });

        if (
          !roundToolCalls ||
          roundToolCalls.length === 0 ||
          !projectSnapshot.params.toolsEnabled
        ) {
          break;
        }

        workingHistory = [
          ...workingHistory,
          {
            id: currentAssistantId,
            role: 'assistant',
            content: roundContent,
            thinking: roundThinking,
            toolCalls: roundToolCalls,
            createdAt: Date.now(),
          },
        ];

        const toolResultMessages: ChatMessage[] = [];
        for (const tc of roundToolCalls) {
          const fnName = tc.function.name;
          const matchedConnector = projectSnapshot.connectors.find(
            (c) => c.enabled && c.name === fnName
          );

          let resultOutput: string;
          let durationMs = 0;
          let ok = false;

          if (!matchedConnector) {
            resultOutput = JSON.stringify(
              { error: `Tool "${fnName}" is not enabled in project "${projectSnapshot.name}".` },
              null,
              2
            );
          } else {
            const exec = await executeSystemConnector(
              matchedConnector,
              tc.function.arguments || {},
              controller.signal,
              projectSnapshot.envVars
            );
            resultOutput = exec.output;
            durationMs = exec.durationMs;
            ok = exec.ok;
          }

          toolResultMessages.push({
            id: `msg-t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'tool',
            toolName: fnName,
            toolDurationMs: durationMs,
            toolSuccess: ok,
            content: resultOutput,
            createdAt: Date.now(),
          });
        }

        const nextAssistantId = `msg-a-${Date.now() + 1}`;
        const nextAssistantPlaceholder: ChatMessage = {
          id: nextAssistantId,
          role: 'assistant',
          content: '',
          thinking: '',
          createdAt: Date.now(),
        };

        workingHistory = [...workingHistory, ...toolResultMessages];
        currentAssistantId = nextAssistantId;

        updateConversation(projectSnapshot.id, convId, (conv) => ({
          ...conv,
          updatedAt: Date.now(),
          messages: [
            ...conv.messages,
            ...toolResultMessages,
            nextAssistantPlaceholder,
          ],
        }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to stream response from Ollama.';
      updateConversation(projectSnapshot.id, convId, (conv) => ({
        ...conv,
        updatedAt: Date.now(),
        messages: conv.messages.map((m) =>
          m.id === currentAssistantId ? { ...m, error: message } : m
        ),
      }));
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (text: string, attachments: ChatAttachment[]) => {
    if (!activeProject || !activeConversation || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: text,
      images: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      thinking: '',
      createdAt: Date.now(),
    };

    const nextMessages = [...activeConversation.messages, userMsg];
    const derivedTitle =
      activeConversation.messages.length === 0
        ? (text || attachments[0]?.name || 'Image prompt').slice(0, 46)
        : activeConversation.title;

    updateConversation(activeProject.id, activeConversation.id, (conv) => ({
      ...conv,
      title: derivedTitle,
      updatedAt: Date.now(),
      messages: [...nextMessages, assistantMsg],
    }));

    await runAssistantGeneration(
      activeProject,
      activeConversation.id,
      activeConversation.model,
      activeConversation.systemPrompt,
      nextMessages,
      assistantMsg.id
    );
  };

  const handleRegenerateLast = async () => {
    if (!activeProject || !activeConversation || isStreaming) return;
    const msgs = activeConversation.messages;
    if (msgs.length === 0) return;

    const last = msgs[msgs.length - 1];
    const historyWithoutLast = last.role === 'assistant' ? msgs.slice(0, -1) : msgs;
    if (historyWithoutLast.length === 0) return;

    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: '',
      createdAt: Date.now(),
    };

    updateConversation(activeProject.id, activeConversation.id, (conv) => ({
      ...conv,
      updatedAt: Date.now(),
      messages: [...historyWithoutLast, assistantMsg],
    }));

    await runAssistantGeneration(
      activeProject,
      activeConversation.id,
      activeConversation.model,
      activeConversation.systemPrompt,
      historyWithoutLast,
      assistantMsg.id
    );
  };

  const handleExportMarkdown = () => {
    if (!activeProject || !activeConversation || activeConversation.messages.length === 0) return;
    const lines: string[] = [
      `# ${activeConversation.title}`,
      `Project: ${activeProject.name}`,
      `Model: ${activeConversation.model}`,
      '',
    ];
    for (const m of activeConversation.messages) {
      if (m.role === 'tool') {
        lines.push(`### Tool Output: ${m.toolName || 'connector'}`, '```json', m.content, '```', '');
        continue;
      }
      lines.push(`## ${m.role === 'user' ? 'User' : 'Assistant'}`);
      if (m.thinking) {
        lines.push(`<details><summary>Reasoning</summary>\n\n${m.thinking}\n\n</details>\n`);
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        lines.push('```json', JSON.stringify(m.toolCalls, null, 2), '```', '');
      }
      if (m.content) {
        lines.push(m.content, '');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSlug =
      activeConversation.title
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'gemma-chat';
    a.download = `${safeSlug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeProject) {
    return null;
  }

  return (
    <div className="cream-burgundy-canvas flex h-screen w-full flex-col overflow-hidden text-[#2B0F17] dark:text-[#F5ECE0] lg:p-3 lg:gap-3">
      {/* Top Bar: 3-Zone Contract */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/80 dark:bg-[#1E0A11]/80 backdrop-blur-xl px-4 sm:px-6 lg:rounded-2xl lg:border shadow-[0_6px_28px_rgba(77,20,34,0.06)] dark:shadow-[0_6px_28px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle conversations sidebar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#6B1D2F]/15 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#2A1019]/75 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#361520] lg:hidden"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <ShamsehEmblem className="h-5 w-5 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0" />
          <span className="font-display text-base font-semibold tracking-tight text-[#2B0F17] dark:text-[#F5ECE0] whitespace-nowrap shrink-0">
            nimchesko AI studio
          </span>
        </div>

        <nav
          aria-label="Workspace mode"
          className="flex items-center gap-1 rounded-xl bg-[#6B1D2F]/6 dark:bg-[#F3E7D8]/6 p-1 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'chat'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#541524] dark:text-[#FAF5EC] shadow-[0_1px_4px_rgba(77,20,34,0.1)] border border-[#6B1D2F]/12 dark:border-transparent'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            Chatbot
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'projects'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#541524] dark:text-[#FAF5EC] shadow-[0_1px_4px_rgba(77,20,34,0.1)] border border-[#6B1D2F]/12 dark:border-transparent'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            Projects &amp; Brain
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'models'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#541524] dark:text-[#FAF5EC] shadow-[0_1px_4px_rgba(77,20,34,0.1)] border border-[#6B1D2F]/12 dark:border-transparent'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            Models &amp; Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'skills'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#541524] dark:text-[#FAF5EC] shadow-[0_1px_4px_rgba(77,20,34,0.1)] border border-[#6B1D2F]/12 dark:border-transparent'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            Skills &amp; Systems
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#541524] dark:text-[#FAF5EC] shadow-[0_1px_4px_rgba(77,20,34,0.1)] border border-[#6B1D2F]/12 dark:border-transparent'
                : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
            }`}
          >
            Integration Guide
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#6B1D2F]/15 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#2A1019]/75 text-[#4D1422] dark:text-[#E6B8A2] hover:bg-[#FAF5EC] dark:hover:bg-[#381622] transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleNewChat}
            title="New chat (Cmd/Ctrl + N)"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0 shadow-[0_2px_10px_rgba(107,29,47,0.2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden lg:gap-3">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-[#2B0F17]/40 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: Isolated Project Switcher + Project-Scoped Histories */}
        <aside
          className={`fixed inset-y-14 left-0 z-30 flex w-[272px] shrink-0 flex-col border-r border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FCF8F2]/92 dark:bg-[#1E0A11]/92 backdrop-blur-xl transition-transform duration-200 lg:static lg:inset-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[#FAF5EC]/75 lg:dark:bg-[#1E0A11]/75 shadow-[0_8px_32px_rgba(77,20,34,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Isolated Project Switcher */}
          <div className="p-3 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#6E4A53] dark:text-[#C5AE9F]">
              <span>Isolated Project</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('projects');
                  setSidebarOpen(false);
                }}
                className="inline-flex items-center gap-1 text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
              >
                <Sliders className="h-3 w-3" />
                <span>Manage</span>
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProjectMenuOpen((v) => !v)}
                aria-expanded={projectMenuOpen}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/85 dark:bg-[#2A1019]/80 px-2.5 py-2 text-left hover:border-[#6B1D2F]/35 dark:hover:border-[#E6B8A2]/35 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ProjectMotifIcon
                    motif={activeProject.motif}
                    className="h-6 w-7 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[#2B0F17] dark:text-[#F5ECE0]">
                      {activeProject.name}
                    </div>
                    <div className="truncate text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                      {activeProject.conversations.length} chats · {activeProject.contextItems.filter((c) => c.enabled).length} ctx
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#6E4A53] dark:text-[#CEB8AE] transition-transform ${
                    projectMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {projectMenuOpen && (
                <div className="mt-1.5 rounded-xl border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#260E16] p-1.5 shadow-lg space-y-1">
                  {projects.map((proj) => {
                    const current = proj.id === activeProject.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleSelectProject(proj.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                          current
                            ? 'bg-[#6B1D2F]/10 dark:bg-[#8C253E]/35 font-semibold text-[#541524] dark:text-[#FAF5EC]'
                            : 'text-[#4D1422] dark:text-[#E8DAD0] hover:bg-[#6B1D2F]/6 dark:hover:bg-[#F3E7D8]/8'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ProjectMotifIcon
                            motif={proj.motif}
                            className="h-4 w-5 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0"
                          />
                          <span className="truncate">{proj.name}</span>
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                          {proj.conversations.length}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setProjectMenuOpen(false);
                      setActiveTab('projects');
                      setSidebarOpen(false);
                    }}
                    className="flex w-full items-center gap-1.5 border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-1.5 px-2 py-1 text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New or configure project...</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Prompts Library */}
          <QuickPromptsSidebarSection
            prompts={activeProject.prompts}
            currentSystemPrompt={activeConversation?.systemPrompt || ''}
            isStreaming={isStreaming}
            onSavePrompt={({ title, kind, content }: { title: string; kind: PromptKind; content: string }) => {
              updateActiveProject((proj) => ({
                ...proj,
                prompts: [
                  {
                    id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    title,
                    category: kind === 'system' ? 'Persona' : 'Quick',
                    kind,
                    content,
                    updatedAt: Date.now(),
                  },
                  ...proj.prompts,
                ],
                updatedAt: Date.now(),
              }));
            }}
            onDeletePrompt={(id) => {
              updateActiveProject((proj) => ({
                ...proj,
                prompts: proj.prompts.filter((p) => p.id !== id),
                updatedAt: Date.now(),
              }));
            }}
            onTriggerQuery={(content) => {
              setActiveTab('chat');
              setSidebarOpen(false);
              void handleSendMessage(content, []);
            }}
            onInsertQueryDraft={(content) => {
              setPendingPrompt({ id: Date.now(), text: content });
              setActiveTab('chat');
              setSidebarOpen(false);
            }}
            onApplySystemPrompt={(content) => {
              if (activeConversation) {
                updateConversation(activeProject.id, activeConversation.id, (c) => ({
                  ...c,
                  systemPrompt: content,
                  updatedAt: Date.now(),
                }));
              }
              setActiveTab('chat');
              setSidebarOpen(false);
            }}
          />

          {/* Search chats within active project */}
          <div className="p-3 border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#8E646F] dark:text-[#B49A9F]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeProject.name}...`}
                className="h-9 w-full rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 bg-[#FCF8F2]/80 dark:bg-[#16080D]/80 pl-8 pr-3 text-xs text-[#2B0F17] dark:text-[#F5ECE0] placeholder:text-[#8E646F] dark:placeholder:text-[#A98F95] focus:border-[#6B1D2F]/50 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Isolated Conversation Histories with Drag-and-Drop Folders */}
          <ConversationFoldersSidebar
            projectName={activeProject.name}
            folders={activeProject.folders}
            conversations={activeProject.conversations}
            activeConversationId={activeConversation?.id}
            isChatTabActive={activeTab === 'chat'}
            searchQuery={searchQuery}
            onSelectConversation={(convId) => {
              updateActiveProject((proj) => ({
                ...proj,
                activeConversationId: convId,
              }));
              setActiveTab('chat');
              setSidebarOpen(false);
            }}
            onDeleteConversation={handleDeleteConversation}
            onCreateFolder={(name) => {
              updateActiveProject((proj) => ({
                ...proj,
                folders: [
                  ...proj.folders,
                  {
                    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name,
                    collapsed: false,
                    createdAt: Date.now(),
                  },
                ],
                updatedAt: Date.now(),
              }));
            }}
            onRenameFolder={(folderId, name) => {
              updateActiveProject((proj) => ({
                ...proj,
                folders: proj.folders.map((f) =>
                  f.id === folderId ? { ...f, name } : f
                ),
                updatedAt: Date.now(),
              }));
            }}
            onDeleteFolder={(folderId) => {
              updateActiveProject((proj) => ({
                ...proj,
                folders: proj.folders.filter((f) => f.id !== folderId),
                conversations: proj.conversations.map((c) =>
                  c.folderId === folderId ? { ...c, folderId: undefined } : c
                ),
                updatedAt: Date.now(),
              }));
            }}
            onToggleFolderCollapse={(folderId) => {
              updateActiveProject((proj) => ({
                ...proj,
                folders: proj.folders.map((f) =>
                  f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
                ),
              }));
            }}
            onMoveConversationToFolder={(convId, folderId) => {
              updateActiveProject((proj) => ({
                ...proj,
                folders: folderId
                  ? proj.folders.map((f) =>
                      f.id === folderId ? { ...f, collapsed: false } : f
                    )
                  : proj.folders,
                conversations: proj.conversations.map((c) =>
                  c.id === convId
                    ? { ...c, folderId: folderId || undefined }
                    : c
                ),
                updatedAt: Date.now(),
              }));
            }}
          />

          <div className="border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer text-[#4D1422] dark:text-[#E8DAD0] font-medium">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                />
                <span>Auto-save</span>
              </label>

              {autoSaveEnabled ? (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                  {saveStatus === 'saving' ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                      <span>
                        Saved{' '}
                        {new Date(lastSavedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => persistWorkspaceNow()}
                  className="inline-flex items-center gap-1 font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
                >
                  <Save className="h-3 w-3" />
                  <span>Save now</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={!activeConversation || activeConversation.messages.length === 0}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-[#6B1D2F]/15 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#2A1019]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#381622] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Markdown</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden lg:rounded-2xl lg:border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#1E0A11]/75 backdrop-blur-xl shadow-[0_8px_32px_rgba(77,20,34,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          {activeTab === 'chat' && activeConversation ? (
            <ChatView
              project={activeProject}
              conversation={activeConversation}
              baseUrl={activeProject.baseUrl}
              onChangeBaseUrl={(baseUrl) =>
                updateActiveProject((p) => ({ ...p, baseUrl, updatedAt: Date.now() }))
              }
              diagnostic={diagnostic}
              onProbeConnection={runProbe}
              params={activeProject.params}
              onChangeParams={(params) =>
                updateActiveProject((p) => ({ ...p, params, updatedAt: Date.now() }))
              }
              onChangeModel={(model) =>
                updateConversation(activeProject.id, activeConversation.id, (c) => ({
                  ...c,
                  model,
                }))
              }
              onChangeSystemPrompt={(systemPrompt) =>
                updateConversation(activeProject.id, activeConversation.id, (c) => ({
                  ...c,
                  systemPrompt,
                }))
              }
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
              onStopStreaming={() => abortControllerRef.current?.abort()}
              onRegenerateLast={handleRegenerateLast}
              onOpenIntegrationGuide={() => setActiveTab('guide')}
              onOpenSkills={() => setActiveTab('skills')}
              onOpenProjects={() => setActiveTab('projects')}
              onOpenModels={() => setActiveTab('models')}
              importedModels={importedModels}
              contextMonitorMode={contextMonitorMode}
              onToggleContextMonitorMode={() =>
                setContextMonitorMode((prev) => !prev)
              }
              onToggleRulesEnabled={(rulesEnabled) =>
                updateActiveProject((p) => ({
                  ...p,
                  rulesEnabled,
                  updatedAt: Date.now(),
                }))
              }
              onToggleContextItem={(itemId) =>
                updateActiveProject((p) => ({
                  ...p,
                  contextItems: p.contextItems.map((item) =>
                    item.id === itemId ? { ...item, enabled: !item.enabled } : item
                  ),
                  updatedAt: Date.now(),
                }))
              }
              onToggleSkill={(skillId) =>
                updateActiveProject((p) => ({
                  ...p,
                  skills: p.skills.map((s) =>
                    s.id === skillId ? { ...s, enabled: !s.enabled } : s
                  ),
                  updatedAt: Date.now(),
                }))
              }
              onClearChat={handleClearChat}
              composerFocusTick={composerFocusTick}
              draftText={drafts[activeConversation.id] || ''}
              onChangeDraft={(convId, text) =>
                setDrafts((prev) => {
                  if (!text) {
                    if (!(convId in prev)) return prev;
                    const next = { ...prev };
                    delete next[convId];
                    return next;
                  }
                  if (prev[convId] === text) return prev;
                  return { ...prev, [convId]: text };
                })
              }
              pendingPrompt={pendingPrompt}
              onConsumePendingPrompt={() => setPendingPrompt(null)}
            />
          ) : activeTab === 'projects' ? (
            <ProjectsView
              projects={projects}
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onUpdateActiveProject={updateActiveProject}
              onUsePromptInChat={(text) => {
                setPendingPrompt({ id: Date.now(), text });
                setActiveTab('chat');
              }}
              onBackToChat={() => setActiveTab('chat')}
            />
          ) : activeTab === 'models' ? (
            <ModelsAndSyncView
              projects={projects}
              activeProject={activeProject}
              activeConversation={activeConversation}
              importedModels={importedModels}
              drafts={drafts}
              diagnostic={diagnostic}
              linkedSyncFileName={linkedSyncFileName}
              lastSyncedAt={lastSyncedAt}
              onProbeConnection={runProbe}
              onAddOrUpdateImportedModel={(profile) => {
                setImportedModels((prev) => {
                  const idx = prev.findIndex(
                    (m) => m.name.toLowerCase() === profile.name.toLowerCase()
                  );
                  if (idx >= 0) {
                    return prev.map((m, i) => (i === idx ? profile : m));
                  }
                  return [profile, ...prev];
                });
              }}
              onDeleteImportedModel={(id) => {
                setImportedModels((prev) => prev.filter((m) => m.id !== id));
              }}
              onSwitchChatModel={(modelName) => {
                if (!activeConversation) return;
                updateConversation(activeProject.id, activeConversation.id, (c) => ({
                  ...c,
                  model: modelName,
                  updatedAt: Date.now(),
                }));
              }}
              onSetProjectDefaultModel={(modelName) => {
                updateActiveProject((p) => ({
                  ...p,
                  defaultModel: modelName,
                  updatedAt: Date.now(),
                }));
              }}
              onSyncProjectChatsToModel={(convIds, targetModel) => {
                const targetSet = new Set(convIds);
                updateActiveProject((p) => ({
                  ...p,
                  conversations: p.conversations.map((c) =>
                    targetSet.has(c.id)
                      ? { ...c, model: targetModel, updatedAt: Date.now() }
                      : c
                  ),
                  updatedAt: Date.now(),
                }));
              }}
              onImportConversationsToActiveProject={(convs) => {
                updateActiveProject((p) => ({
                  ...p,
                  conversations: [...convs, ...p.conversations],
                  activeConversationId: convs[0]?.id || p.activeConversationId,
                  updatedAt: Date.now(),
                }));
              }}
              onApplyMergedWorkspace={(merged) => {
                setProjects(merged.projects);
                setImportedModels(merged.importedModels);
                setDrafts(merged.drafts);
              }}
              onLinkLocalSyncFile={async () => {
                const win = window as unknown as {
                  showSaveFilePicker?: (opts?: {
                    suggestedName?: string;
                    types?: Array<{
                      description: string;
                      accept: Record<string, string[]>;
                    }>;
                  }) => Promise<SyncFileHandleLike>;
                };
                if (!win.showSaveFilePicker) return;
                try {
                  const handle = await win.showSaveFilePicker({
                    suggestedName: 'nimchesko-ai-studio-sync.json',
                    types: [
                      {
                        description: 'nimchesko AI studio Sync Bundle',
                        accept: { 'application/json': ['.json'] },
                      },
                    ],
                  });
                  syncFileHandleRef.current = handle;
                  setLinkedSyncFileName(handle.name);
                  await mirrorToLinkedSyncFile(
                    projectsRef.current,
                    importedModelsRef.current,
                    draftsRef.current
                  );
                } catch {
                  // User cancelled picker
                }
              }}
              onPullFromLinkedSyncFile={async () => {
                const handle = syncFileHandleRef.current;
                if (!handle) return null;
                try {
                  const file = await handle.getFile();
                  const text = await file.text();
                  if (!text.trim()) return 'Linked sync file is empty.';
                  const bundle = JSON.parse(text) as WorkspaceSyncBundle;
                  if (!Array.isArray(bundle.projects)) {
                    return 'Linked file is not a valid nimchesko AI studio sync bundle.';
                  }
                  const merged = mergeWorkspaceSyncBundle(
                    projectsRef.current,
                    importedModelsRef.current,
                    draftsRef.current,
                    bundle
                  );
                  setProjects(merged.projects);
                  setImportedModels(merged.importedModels);
                  setDrafts(merged.drafts);
                  setLastSyncedAt(Date.now());
                  return `Pulled & merged ${merged.stats.chatsAdded} new and ${merged.stats.chatsUpdated} updated chat(s).`;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Could not read linked sync file.';
                }
              }}
              onUnlinkSyncFile={() => {
                syncFileHandleRef.current = null;
                setLinkedSyncFileName(null);
              }}
              onBackToChat={() => setActiveTab('chat')}
            />
          ) : activeTab === 'skills' ? (
            <SkillsAndConnectorsView
              projectName={activeProject.name}
              brainPrompt={activeProject.brainPrompt}
              rulesMarkdown={activeProject.rulesMarkdown}
              rulesEnabled={activeProject.rulesEnabled}
              contextItems={activeProject.contextItems}
              envVars={activeProject.envVars}
              skills={activeProject.skills}
              onChangeSkills={(skills) =>
                updateActiveProject((p) => ({ ...p, skills, updatedAt: Date.now() }))
              }
              connectors={activeProject.connectors}
              onChangeConnectors={(connectors) =>
                updateActiveProject((p) => ({
                  ...p,
                  connectors,
                  updatedAt: Date.now(),
                }))
              }
              toolsEnabled={activeProject.params.toolsEnabled}
              onToggleToolsEnabled={(toolsEnabled) =>
                updateActiveProject((p) => ({
                  ...p,
                  params: { ...p.params, toolsEnabled },
                  updatedAt: Date.now(),
                }))
              }
              baseSystemPrompt={activeConversation?.systemPrompt || ''}
              model={activeConversation?.model || activeProject.defaultModel}
              onBackToChat={() => setActiveTab('chat')}
            />
          ) : (
            <IntegrationGuide
              projectName={activeProject.name}
              baseUrl={activeProject.baseUrl}
              onChangeBaseUrl={(baseUrl) =>
                updateActiveProject((p) => ({ ...p, baseUrl, updatedAt: Date.now() }))
              }
              model={activeConversation?.model || activeProject.defaultModel}
              diagnostic={diagnostic}
              onProbeConnection={runProbe}
              onBackToChat={() => setActiveTab('chat')}
            />
          )}
        </main>
      </div>

      <OfflineIndicator />
    </div>
  );
}
