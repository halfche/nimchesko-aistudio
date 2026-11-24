import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Plus,
  Send,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { ProjectPrompt, PromptKind } from '../types/ollama';

interface QuickPromptsSidebarSectionProps {
  prompts: ProjectPrompt[];
  currentSystemPrompt: string;
  isStreaming: boolean;
  onSavePrompt: (input: { title: string; kind: PromptKind; content: string }) => void;
  onDeletePrompt: (id: string) => void;
  onTriggerQuery: (content: string) => void;
  onInsertQueryDraft: (content: string) => void;
  onApplySystemPrompt: (content: string) => void;
}

export function QuickPromptsSidebarSection({
  prompts,
  currentSystemPrompt,
  isStreaming,
  onSavePrompt,
  onDeletePrompt,
  onTriggerQuery,
  onInsertQueryDraft,
  onApplySystemPrompt,
}: QuickPromptsSidebarSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PromptKind>('query');
  const [content, setContent] = useState('');
  const [justTriggeredId, setJustTriggeredId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return;
    onSavePrompt({
      title: title.trim(),
      kind,
      content: content.trim(),
    });
    setTitle('');
    setContent('');
    setShowAddForm(false);
    setExpanded(true);
  };

  const handleRowClick = (p: ProjectPrompt) => {
    const promptKind: PromptKind = p.kind === 'system' ? 'system' : 'query';
    if (promptKind === 'system') {
      onApplySystemPrompt(p.content);
    } else {
      if (isStreaming) return;
      onTriggerQuery(p.content);
    }
    setJustTriggeredId(p.id);
    window.setTimeout(() => setJustTriggeredId(null), 1200);
  };

  return (
    <div className="border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#6E4A53] dark:text-[#C5AE9F] hover:text-[#3A101B] dark:hover:text-[#FAF5EC] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>Quick Prompts</span>
          <span className="font-mono tabular-nums opacity-80">({prompts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v);
            setExpanded(true);
          }}
          aria-label="Save quick prompt"
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>Save</span>
        </button>
      </div>

      {showAddForm && (
        <div className="mt-2 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/90 dark:bg-[#16080D]/85 p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/8 p-0.5">
            <button
              type="button"
              onClick={() => setKind('query')}
              className={`rounded-md py-1 text-[11px] font-medium transition-colors ${
                kind === 'query'
                  ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                  : 'text-[#6E4A53] dark:text-[#CEB8AE]'
              }`}
            >
              User Query
            </button>
            <button
              type="button"
              onClick={() => setKind('system')}
              className={`rounded-md py-1 text-[11px] font-medium transition-colors ${
                kind === 'system'
                  ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                  : 'text-[#6E4A53] dark:text-[#CEB8AE]'
              }`}
            >
              System Prompt
            </button>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'system' ? 'e.g. Strict JSON Persona' : 'e.g. Summarize Files'}
            className="h-8 w-full rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/14 bg-white/85 dark:bg-[#230D14]/85 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0] placeholder:text-[#8E646F] dark:placeholder:text-[#A98F95] focus:border-[#6B1D2F]/50 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
          />

          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              kind === 'system'
                ? 'System prompt instructions to apply...'
                : 'User query to run with one click...'
            }
            className="w-full resize-none rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/14 bg-white/85 dark:bg-[#230D14]/85 px-2.5 py-1.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0] placeholder:text-[#8E646F] dark:placeholder:text-[#A98F95] focus:border-[#6B1D2F]/50 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
          />

          {kind === 'system' && currentSystemPrompt.trim() && (
            <button
              type="button"
              onClick={() => setContent(currentSystemPrompt.trim())}
              className="text-[11px] text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline"
            >
              Load active chat system prompt
            </button>
          )}

          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="h-7 rounded-lg border border-[#6B1D2F]/16 dark:border-[#F3E7D8]/14 px-2.5 text-[11px] font-medium text-[#4D1422] dark:text-[#F5ECE0]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || !content.trim()}
              className="h-7 rounded-lg bg-[#6B1D2F] dark:bg-[#8C253E] px-2.5 text-[11px] font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-0.5">
          {prompts.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-[#6E4A53] dark:text-[#CEB8AE]">
              No quick prompts saved yet.
            </p>
          ) : (
            prompts.map((p) => {
              const promptKind: PromptKind = p.kind === 'system' ? 'system' : 'query';
              const isSystemActive =
                promptKind === 'system' &&
                currentSystemPrompt.trim().length > 0 &&
                currentSystemPrompt.trim() === p.content.trim();
              const isTriggered = justTriggeredId === p.id;

              return (
                <div
                  key={p.id}
                  className={`group flex items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 transition-colors ${
                    isSystemActive
                      ? 'bg-[#6B1D2F]/10 dark:bg-[#8C253E]/30 border border-[#6B1D2F]/20 dark:border-[#E6B8A2]/25'
                      : 'border border-transparent hover:bg-[#FCF8F2]/65 dark:hover:bg-[#2B1018]/70'
                  }`}
                >
                  <button
                    type="button"
                    disabled={promptKind === 'query' && isStreaming}
                    onClick={() => handleRowClick(p)}
                    title={
                      promptKind === 'system'
                        ? `Apply system prompt: ${p.content}`
                        : `Send query: ${p.content}`
                    }
                    className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:opacity-50"
                  >
                    {promptKind === 'system' ? (
                      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    ) : (
                      <Send className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-[#2B0F17] dark:text-[#F5ECE0]">
                        {p.title}
                      </div>
                      <div className="truncate text-[10px] text-[#6E4A53] dark:text-[#C5AE9F]">
                        {promptKind === 'system' ? 'System prompt' : 'User query'}
                        {isSystemActive && ' · Active'}
                        {isTriggered && (promptKind === 'system' ? ' · Applied' : ' · Sent')}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    {promptKind === 'query' && (
                      <button
                        type="button"
                        onClick={() => onInsertQueryDraft(p.content)}
                        aria-label={`Insert ${p.title} into composer`}
                        title="Insert into composer without sending"
                        className="rounded-md p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                      >
                        <CornerDownLeft className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeletePrompt(p.id)}
                      aria-label={`Delete ${p.title}`}
                      title="Delete quick prompt"
                      className="rounded-md p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
