import { useState, type DragEvent } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation, ConversationFolder } from '../types/ollama';

interface ConversationFoldersSidebarProps {
  projectName: string;
  folders: ConversationFolder[];
  conversations: Conversation[];
  activeConversationId?: string;
  isChatTabActive: boolean;
  searchQuery: string;
  onSelectConversation: (convId: string) => void;
  onDeleteConversation: (convId: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolderCollapse: (folderId: string) => void;
  onMoveConversationToFolder: (convId: string, folderId: string | null) => void;
}

const DRAG_DATA_MIME = 'application/x-gemma-conversation-id';

export function ConversationFoldersSidebar({
  projectName,
  folders,
  conversations,
  activeConversationId,
  isChatTabActive,
  searchQuery,
  onSelectConversation,
  onDeleteConversation,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolderCollapse,
  onMoveConversationToFolder,
}: ConversationFoldersSidebarProps) {
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // folder.id or '__ungrouped__'
  const [moveMenuConvId, setMoveMenuConvId] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (conv: Conversation) => {
    if (!normalizedQuery) return true;
    return (
      conv.title.toLowerCase().includes(normalizedQuery) ||
      conv.model.toLowerCase().includes(normalizedQuery) ||
      conv.messages.some((m) => m.content.toLowerCase().includes(normalizedQuery))
    );
  };

  const folderIdSet = new Set(folders.map((f) => f.id));

  const conversationsByFolder = new Map<string, Conversation[]>();
  for (const folder of folders) {
    conversationsByFolder.set(folder.id, []);
  }

  const ungroupedConversations: Conversation[] = [];
  for (const conv of conversations) {
    if (!matchesSearch(conv)) continue;
    if (conv.folderId && folderIdSet.has(conv.folderId)) {
      conversationsByFolder.get(conv.folderId)?.push(conv);
    } else {
      ungroupedConversations.push(conv);
    }
  }

  const totalMatching =
    ungroupedConversations.length +
    folders.reduce((acc, f) => acc + (conversationsByFolder.get(f.id)?.length || 0), 0);

  const handleCreateSubmit = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleRenameSubmit = (folderId: string) => {
    const trimmed = editingFolderName.trim();
    if (trimmed) {
      onRenameFolder(folderId, trimmed);
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const getDraggedId = (e: DragEvent): string | null => {
    return (
      e.dataTransfer.getData(DRAG_DATA_MIME) ||
      e.dataTransfer.getData('text/plain') ||
      draggingConvId
    );
  };

  const handleDragStart = (e: DragEvent, convId: string) => {
    setDraggingConvId(convId);
    setMoveMenuConvId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_DATA_MIME, convId);
    e.dataTransfer.setData('text/plain', convId);
  };

  const handleDragEnd = () => {
    setDraggingConvId(null);
    setDragOverTarget(null);
  };

  const handleDropOnFolder = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const convId = getDraggedId(e);
    setDragOverTarget(null);
    setDraggingConvId(null);
    if (convId) {
      onMoveConversationToFolder(convId, folderId);
    }
  };

  const handleDropOnUngrouped = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const convId = getDraggedId(e);
    setDragOverTarget(null);
    setDraggingConvId(null);
    if (convId) {
      onMoveConversationToFolder(convId, null);
    }
  };

  const renderConversationRow = (conv: Conversation, nestedInFolder: boolean) => {
    const isActive = conv.id === activeConversationId && isChatTabActive;
    const isDragging = draggingConvId === conv.id;
    const showMoveMenu = moveMenuConvId === conv.id;

    return (
      <div key={conv.id} className="relative">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, conv.id)}
          onDragEnd={handleDragEnd}
          className={`group flex items-center justify-between gap-1.5 rounded-xl px-2 py-2 transition-colors ${
            nestedInFolder ? 'pl-2' : ''
          } ${
            isDragging
              ? 'opacity-45 border border-dashed border-[#6B1D2F]/45 dark:border-[#E6B8A2]/45'
              : isActive
                ? 'bg-[#FCF8F2] dark:bg-[#2F121B] border border-[#6B1D2F]/18 dark:border-[#E6B8A2]/20 text-[#2B0F17] dark:text-[#FAF5EC] shadow-[0_2px_10px_rgba(77,20,34,0.05)]'
                : 'border border-transparent text-[#4D1422]/85 dark:text-[#DECFC5] hover:bg-[#FCF8F2]/55 dark:hover:bg-[#2B1018]/65'
          }`}
        >
          <span
            aria-hidden="true"
            title="Drag to organize into a folder"
            className="cursor-grab active:cursor-grabbing text-[#8E646F]/60 dark:text-[#A98F95]/60 group-hover:text-[#6B1D2F] dark:group-hover:text-[#E6B8A2] transition-colors shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>

          <button
            type="button"
            onClick={() => onSelectConversation(conv.id)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            <MessageSquare
              className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                isActive
                  ? 'text-[#6B1D2F] dark:text-[#E6B8A2]'
                  : 'text-[#8E646F] dark:text-[#A98F95]'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{conv.title}</div>
              <div className="mt-0.5 truncate text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#BFA8A0]">
                {conv.model} · {conv.messages.length} msgs
              </div>
            </div>
          </button>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
            {folders.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setMoveMenuConvId((cur) => (cur === conv.id ? null : conv.id))
                }
                aria-label={`Move ${conv.title} to folder`}
                title="Move to folder"
                className="rounded-lg p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteConversation(conv.id)}
              aria-label={`Delete ${conv.title}`}
              title="Delete chat"
              className="rounded-lg p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showMoveMenu && folders.length > 0 && (
          <div className="mt-1 ml-5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#260E16] p-1 shadow-lg space-y-0.5 z-20 relative">
            <div className="px-2 py-1 text-[10px] font-medium text-[#6E4A53] dark:text-[#C5AE9F]">
              Move chat to
            </div>
            {folders.map((folder) => {
              const isCurrent = conv.folderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onMoveConversationToFolder(conv.id, folder.id);
                    setMoveMenuConvId(null);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                    isCurrent
                      ? 'bg-[#6B1D2F]/10 dark:bg-[#8C253E]/35 font-semibold text-[#541524] dark:text-[#FAF5EC]'
                      : 'text-[#4D1422] dark:text-[#E8DAD0] hover:bg-[#6B1D2F]/6 dark:hover:bg-[#F3E7D8]/8'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Folder className="h-3 w-3 shrink-0 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  {isCurrent && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                onMoveConversationToFolder(conv.id, null);
                setMoveMenuConvId(null);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                !conv.folderId || !folderIdSet.has(conv.folderId)
                  ? 'bg-[#6B1D2F]/10 dark:bg-[#8C253E]/35 font-semibold text-[#541524] dark:text-[#FAF5EC]'
                  : 'text-[#4D1422] dark:text-[#E8DAD0] hover:bg-[#6B1D2F]/6 dark:hover:bg-[#F3E7D8]/8'
              }`}
            >
              <span className="truncate">Ungrouped</span>
              {(!conv.folderId || !folderIdSet.has(conv.folderId)) && (
                <Check className="h-3 w-3 shrink-0" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header row with + Folder action */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-[#6E4A53] dark:text-[#C5AE9F]">
          <span>Conversations</span>
          <span className="ml-1 font-mono tabular-nums opacity-80">
            ({conversations.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNewFolderInput((v) => !v);
            setNewFolderName('');
          }}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 transition-colors"
        >
          <FolderPlus className="h-3 w-3" />
          <span>Folder</span>
        </button>
      </div>

      {/* Inline New Folder Creator */}
      {showNewFolderInput && (
        <div className="mx-3 mb-2 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-2 space-y-2">
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateSubmit();
              } else if (e.key === 'Escape') {
                setShowNewFolderInput(false);
              }
            }}
            placeholder="Folder name (e.g. Architecture)..."
            className="h-8 w-full rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/14 bg-white/85 dark:bg-[#230D14]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0] placeholder:text-[#8E646F] dark:placeholder:text-[#A98F95] focus:border-[#6B1D2F]/50 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowNewFolderInput(false)}
              className="h-7 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/14 px-2.5 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={!newFolderName.trim()}
              className="h-7 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 text-[11px] font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Folders & Conversations Tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {totalMatching === 0 && folders.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
            No matching chats in {projectName}
          </p>
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => {
              const folderConvs = conversationsByFolder.get(folder.id) || [];
              const isDropTarget = dragOverTarget === folder.id;
              const isCollapsed = Boolean(folder.collapsed) && !normalizedQuery;
              const isEditing = editingFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverTarget !== folder.id) {
                      setDragOverTarget(folder.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverTarget((cur) => (cur === folder.id ? null : cur));
                    }
                  }}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                  className={`rounded-xl border transition-colors ${
                    isDropTarget
                      ? 'border-[#6B1D2F]/55 dark:border-[#E6B8A2]/55 bg-[#6B1D2F]/8 dark:bg-[#8C253E]/25'
                      : 'border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 bg-[#FCF8F2]/35 dark:bg-[#16080D]/35'
                  }`}
                >
                  <div className="group flex items-center justify-between gap-1 px-2 py-1.5">
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameSubmit(folder.id);
                            } else if (e.key === 'Escape') {
                              setEditingFolderId(null);
                            }
                          }}
                          className="h-6 flex-1 min-w-0 rounded-md border border-[#6B1D2F]/25 dark:border-[#E6B8A2]/25 bg-white/90 dark:bg-[#230D14]/90 px-1.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSubmit(folder.id)}
                          aria-label="Save folder name"
                          className="rounded p-1 text-[#6B1D2F] dark:text-[#E6B8A2]"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFolderId(null)}
                          aria-label="Cancel folder rename"
                          className="rounded p-1 text-[#6E4A53] dark:text-[#CEB8AE]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleFolderCollapse(folder.id)}
                          aria-expanded={!isCollapsed}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6E4A53] dark:text-[#C5AE9F]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#6E4A53] dark:text-[#C5AE9F]" />
                          )}
                          {isCollapsed ? (
                            <Folder className="h-3.5 w-3.5 shrink-0 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                          ) : (
                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                          )}
                          <span className="truncate text-xs font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                            {folder.name}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F] shrink-0">
                            {folderConvs.length}
                          </span>
                        </button>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}
                            aria-label={`Rename ${folder.name}`}
                            title="Rename folder"
                            className="rounded p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFolder(folder.id)}
                            aria-label={`Delete folder ${folder.name}`}
                            title="Delete folder (keeps chats)"
                            className="rounded p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="px-1 pb-1.5 space-y-1">
                      {folderConvs.length === 0 ? (
                        <div className="rounded-lg px-2 py-2 text-center text-[11px] text-[#8E646F] dark:text-[#A98F95]">
                          {isDropTarget
                            ? 'Drop chat here'
                            : normalizedQuery
                              ? 'No matching chats'
                              : 'Drag chats here to organize'}
                        </div>
                      ) : (
                        folderConvs.map((conv) => renderConversationRow(conv, true))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped / Root Chats Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverTarget !== '__ungrouped__') {
                  setDragOverTarget('__ungrouped__');
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverTarget((cur) => (cur === '__ungrouped__' ? null : cur));
                }
              }}
              onDrop={handleDropOnUngrouped}
              className={`rounded-xl transition-colors space-y-1 ${
                dragOverTarget === '__ungrouped__'
                  ? 'border border-[#6B1D2F]/45 dark:border-[#E6B8A2]/45 bg-[#6B1D2F]/8 dark:bg-[#8C253E]/20 p-1.5'
                  : ''
              }`}
            >
              {(folders.length > 0 || draggingConvId) && (
                <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-medium text-[#8E646F] dark:text-[#B49A9F]">
                  <span>{folders.length > 0 ? 'Ungrouped' : 'All Chats'}</span>
                  {dragOverTarget === '__ungrouped__' && (
                    <span className="text-[#6B1D2F] dark:text-[#E6B8A2]">
                      Drop to ungroup
                    </span>
                  )}
                </div>
              )}

              {ungroupedConversations.length === 0 ? (
                totalMatching === 0 && normalizedQuery ? (
                  <p className="px-3 py-4 text-center text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                    No matching chats in {projectName}
                  </p>
                ) : draggingConvId && folders.length > 0 ? (
                  <div className="rounded-lg border border-dashed border-[#6B1D2F]/20 dark:border-[#F3E7D8]/20 px-2 py-2.5 text-center text-[11px] text-[#8E646F] dark:text-[#A98F95]">
                    Drop here to remove from folder
                  </div>
                ) : null
              ) : (
                ungroupedConversations.map((conv) => renderConversationRow(conv, false))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
