import type {
  ChatMessage,
  Conversation,
  ImportedModelProfile,
  WorkspaceProject,
  WorkspaceSyncBundle,
} from '../types/ollama';

export function buildWorkspaceSyncBundle(
  projects: WorkspaceProject[],
  importedModels: ImportedModelProfile[],
  drafts: Record<string, string>
): WorkspaceSyncBundle {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    sourcePlatform:
      typeof navigator !== 'undefined' ? navigator.platform : 'web',
    projects,
    importedModels,
    drafts,
  };
}

export function mergeWorkspaceSyncBundle(
  currentProjects: WorkspaceProject[],
  currentModels: ImportedModelProfile[],
  currentDrafts: Record<string, string>,
  incoming: WorkspaceSyncBundle
): {
  projects: WorkspaceProject[];
  importedModels: ImportedModelProfile[];
  drafts: Record<string, string>;
  stats: {
    projectsAdded: number;
    projectsMerged: number;
    chatsAdded: number;
    chatsUpdated: number;
    modelsAdded: number;
  };
} {
  let projectsAdded = 0;
  let projectsMerged = 0;
  let chatsAdded = 0;
  let chatsUpdated = 0;
  let modelsAdded = 0;

  const projectMap = new Map<string, WorkspaceProject>();
  for (const proj of currentProjects) {
    projectMap.set(proj.id, proj);
  }

  for (const incProj of incoming.projects || []) {
    const existing = projectMap.get(incProj.id);
    if (!existing) {
      projectMap.set(incProj.id, {
        ...incProj,
        folders: Array.isArray(incProj.folders) ? incProj.folders : [],
      });
      projectsAdded++;
      chatsAdded += incProj.conversations?.length || 0;
      continue;
    }

    projectsMerged++;
    const convMap = new Map<string, Conversation>();
    for (const c of existing.conversations) {
      convMap.set(c.id, c);
    }

    for (const incConv of incProj.conversations || []) {
      const curConv = convMap.get(incConv.id);
      if (!curConv) {
        convMap.set(incConv.id, incConv);
        chatsAdded++;
      } else if (
        incConv.updatedAt > curConv.updatedAt ||
        (incConv.updatedAt === curConv.updatedAt &&
          incConv.messages.length > curConv.messages.length)
      ) {
        convMap.set(incConv.id, incConv);
        chatsUpdated++;
      }
    }

    const folderMap = new Map(existing.folders.map((f) => [f.id, f]));
    for (const incFolder of incProj.folders || []) {
      if (!folderMap.has(incFolder.id)) {
        folderMap.set(incFolder.id, incFolder);
      }
    }

    const mergedConvs = Array.from(convMap.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    const preferIncomingProjectMeta = incProj.updatedAt > existing.updatedAt;
    projectMap.set(incProj.id, {
      ...(preferIncomingProjectMeta ? incProj : existing),
      folders: Array.from(folderMap.values()),
      conversations: mergedConvs,
      activeConversationId:
        existing.activeConversationId || mergedConvs[0]?.id || '',
      updatedAt: Math.max(existing.updatedAt, incProj.updatedAt),
    });
  }

  const modelMap = new Map<string, ImportedModelProfile>();
  for (const m of currentModels) {
    modelMap.set(m.name.toLowerCase(), m);
  }
  for (const incModel of incoming.importedModels || []) {
    const key = incModel.name.toLowerCase();
    const cur = modelMap.get(key);
    if (!cur) {
      modelMap.set(key, incModel);
      modelsAdded++;
    } else if (incModel.updatedAt > cur.updatedAt) {
      modelMap.set(key, incModel);
    }
  }

  const mergedDrafts: Record<string, string> = {
    ...(incoming.drafts || {}),
    ...currentDrafts,
  };

  return {
    projects: Array.from(projectMap.values()),
    importedModels: Array.from(modelMap.values()),
    drafts: mergedDrafts,
    stats: {
      projectsAdded,
      projectsMerged,
      chatsAdded,
      chatsUpdated,
      modelsAdded,
    },
  };
}

function parseMarkdownChatFile(
  filename: string,
  text: string,
  defaultModel: string
): Conversation[] {
  const lines = text.split(/\r?\n/);
  let title = filename.replace(/\.[^.]+$/, '') || 'Imported Chat';
  const messages: ChatMessage[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (currentRole && content) {
      messages.push({
        id: `msg-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: currentRole,
        content,
        createdAt: Date.now(),
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith('# ') && messages.length === 0 && !currentRole) {
      title = line.slice(2).trim() || title;
      continue;
    }
    if (/^##\s*(User|You|Human)\s*$/i.test(line.trim())) {
      flush();
      currentRole = 'user';
      continue;
    }
    if (/^##\s*(Assistant|Gemma|Model|AI)\s*$/i.test(line.trim())) {
      flush();
      currentRole = 'assistant';
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (messages.length === 0 && text.trim()) {
    messages.push({
      id: `msg-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: text.trim(),
      createdAt: Date.now(),
    });
  }

  return [
    {
      id: `conv-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.slice(0, 80),
      model: defaultModel,
      systemPrompt: '',
      messages,
      updatedAt: Date.now(),
    },
  ];
}

export function parseImportedChatFiles(
  filename: string,
  rawText: string,
  defaultModel: string
): {
  type: 'workspace-bundle' | 'conversations';
  bundle?: WorkspaceSyncBundle;
  conversations?: Conversation[];
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error(`File "${filename}" is empty.`);
  }

  if (filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;

      // 1. Full Gemma Studio Workspace Sync Bundle
      if (
        parsed &&
        typeof parsed === 'object' &&
        'projects' in parsed &&
        Array.isArray((parsed as WorkspaceSyncBundle).projects)
      ) {
        const bundle = parsed as WorkspaceSyncBundle;
        return {
          type: 'workspace-bundle',
          bundle: {
            schemaVersion: 1,
            exportedAt: bundle.exportedAt || Date.now(),
            sourcePlatform: bundle.sourcePlatform,
            projects: bundle.projects,
            importedModels: Array.isArray(bundle.importedModels)
              ? bundle.importedModels
              : [],
            drafts:
              bundle.drafts && typeof bundle.drafts === 'object'
                ? bundle.drafts
                : {},
          },
        };
      }

      // 2. Array of conversations (e.g. ChatGPT conversations.json or Gemma Studio list)
      if (Array.isArray(parsed)) {
        const importedConvs: Conversation[] = [];
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as Record<string, unknown>;

          // Standard Conversation object
          if (Array.isArray(rec.messages)) {
            const msgs: ChatMessage[] = [];
            for (const m of rec.messages) {
              if (!m || typeof m !== 'object') continue;
              const mr = m as Record<string, unknown>;
              const role =
                mr.role === 'assistant' || mr.role === 'user'
                  ? mr.role
                  : mr.role === 'model'
                    ? 'assistant'
                    : null;
              if (!role || typeof mr.content !== 'string' || !mr.content.trim()) {
                continue;
              }
              msgs.push({
                id: `msg-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content: mr.content,
                createdAt:
                  typeof mr.createdAt === 'number' ? mr.createdAt : Date.now(),
              });
            }
            if (msgs.length > 0) {
              importedConvs.push({
                id: `conv-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title:
                  typeof rec.title === 'string' && rec.title.trim()
                    ? rec.title.trim()
                    : 'Imported Chat',
                model:
                  typeof rec.model === 'string' && rec.model.trim()
                    ? rec.model.trim()
                    : defaultModel,
                systemPrompt:
                  typeof rec.systemPrompt === 'string' ? rec.systemPrompt : '',
                messages: msgs,
                updatedAt:
                  typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now(),
              });
            }
          } else if (rec.mapping && typeof rec.mapping === 'object') {
            // ChatGPT export mapping node tree
            const mapping = rec.mapping as Record<
              string,
              {
                message?: {
                  author?: { role?: string };
                  content?: { parts?: unknown[] };
                  create_time?: number;
                };
              }
            >;
            const msgs: ChatMessage[] = [];
            for (const node of Object.values(mapping)) {
              const roleRaw = node.message?.author?.role;
              const role =
                roleRaw === 'user'
                  ? 'user'
                  : roleRaw === 'assistant'
                    ? 'assistant'
                    : null;
              const parts = node.message?.content?.parts;
              const text = Array.isArray(parts)
                ? parts.filter((p) => typeof p === 'string').join('\n').trim()
                : '';
              if (role && text) {
                msgs.push({
                  id: `msg-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  role,
                  content: text,
                  createdAt: node.message?.create_time
                    ? node.message.create_time * 1000
                    : Date.now(),
                });
              }
            }
            if (msgs.length > 0) {
              msgs.sort((a, b) => a.createdAt - b.createdAt);
              importedConvs.push({
                id: `conv-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title:
                  typeof rec.title === 'string' && rec.title.trim()
                    ? rec.title.trim()
                    : 'Imported ChatGPT Thread',
                model: defaultModel,
                systemPrompt: '',
                messages: msgs,
                updatedAt: Date.now(),
              });
            }
          }
        }
        if (importedConvs.length > 0) {
          return { type: 'conversations', conversations: importedConvs };
        }
      }

      // 3. Single Conversation JSON object
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { messages?: unknown[] }).messages)) {
        const rec = parsed as { title?: string; model?: string; systemPrompt?: string; messages: Array<{ role?: string; content?: string }> };
        const msgs: ChatMessage[] = rec.messages
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({
            id: `msg-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: m.role as 'user' | 'assistant',
            content: m.content || '',
            createdAt: Date.now(),
          }));
        return {
          type: 'conversations',
          conversations: [
            {
              id: `conv-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: rec.title || filename.replace(/\.[^.]+$/, ''),
              model: rec.model || defaultModel,
              systemPrompt: rec.systemPrompt || '',
              messages: msgs,
              updatedAt: Date.now(),
            },
          ],
        };
      }
    } catch {
      // Fall back to Markdown / text parsing if JSON fails
    }
  }

  return {
    type: 'conversations',
    conversations: parseMarkdownChatFile(filename, rawText, defaultModel),
  };
}
