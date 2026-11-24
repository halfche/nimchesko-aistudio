import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Gauge,
  Layers,
  MessageSquare,
  Sliders,
  Wrench,
  X,
} from 'lucide-react';
import type { ModelParameters, WorkspaceProject } from '../types/ollama';
import { formatTokenCount, type ContextSnapshot } from '../services/contextMetrics';

interface ContextMonitorStripProps {
  snapshot: ContextSnapshot;
  onOpenModal: () => void;
  onDisableMonitorMode: () => void;
}

export function ContextMonitorStrip({
  snapshot,
  onOpenModal,
  onDisableMonitorMode,
}: ContextMonitorStripProps) {
  const { breakdown, totalEstimatedTokens, numCtx, utilizationPct, status, statusLabel } =
    snapshot;

  const barTone =
    status === 'critical'
      ? 'bg-[#9E1B32] dark:bg-[#F06B82]'
      : status === 'elevated'
        ? 'bg-[#B45309] dark:bg-[#F59E0B]'
        : 'bg-[#6B1D2F] dark:bg-[#E6B8A2]';

  const statusTone =
    status === 'critical'
      ? 'text-[#9E1B32] dark:text-[#F899A9]'
      : status === 'elevated'
        ? 'text-[#9A4A0B] dark:text-[#FBBF24]'
        : 'text-[#4D1422] dark:text-[#E6B8A2]';

  return (
    <div className="border-b border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 bg-[#FCF8F2]/65 dark:bg-[#19080E]/75 backdrop-blur-md px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex flex-1 min-w-[240px] items-center gap-3 text-left group"
          title="Open detailed Context Monitor pop-up"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <Activity className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
            <span className="text-xs font-medium text-[#3A101B] dark:text-[#F5ECE0] group-hover:underline">
              Context Monitor
            </span>
            <span className={`text-[11px] font-medium ${statusTone}`}>
              · {statusLabel}
            </span>
          </div>

          <div className="h-1.5 w-28 sm:w-40 overflow-hidden rounded-full bg-[#6B1D2F]/12 dark:bg-[#F3E7D8]/12 shrink-0">
            <div
              className={`h-full transition-all duration-200 ${barTone}`}
              style={{ width: `${Math.max(2, utilizationPct)}%` }}
            />
          </div>

          <div className="text-xs font-mono tabular-nums text-[#6E4A53] dark:text-[#CEB8AE] truncate">
            ~{formatTokenCount(totalEstimatedTokens)} / {formatTokenCount(numCtx)} ({utilizationPct}%)
            {snapshot.lastReportedPromptTokens !== undefined && (
              <span className="hidden md:inline">
                {' '}
                · last eval {snapshot.lastReportedPromptTokens.toLocaleString()} tok
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F] shrink-0">
          <span className="hidden lg:inline">
            sys {formatTokenCount(snapshot.systemLayerTokens)} · files{' '}
            {formatTokenCount(breakdown.resourcesTokens)} · hist{' '}
            {formatTokenCount(breakdown.historyTokens)}
            {breakdown.draftTokens > 0 ? ` · draft ${breakdown.draftTokens}` : ''}
          </span>
          <button
            type="button"
            onClick={onOpenModal}
            className="font-sans text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:underline whitespace-nowrap"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={onDisableMonitorMode}
            aria-label="Hide live context monitor bar"
            title="Hide live monitor bar"
            className="rounded-md p-1 text-[#8E646F] dark:text-[#B49A9F] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContextMonitorModalProps {
  open: boolean;
  onClose: () => void;
  project: WorkspaceProject;
  model: string;
  params: ModelParameters;
  snapshot: ContextSnapshot;
  monitorModeEnabled: boolean;
  onToggleMonitorMode: () => void;
  onChangeNumCtx: (numCtx: number) => void;
  onToggleRulesEnabled: (enabled: boolean) => void;
  onToggleToolsEnabled: (enabled: boolean) => void;
  onToggleContextItem: (id: string) => void;
  onToggleSkill: (id: string) => void;
}

const CTX_OPTIONS = [4096, 8192, 16384, 32768, 65536, 131072];

export function ContextMonitorModal({
  open,
  onClose,
  project,
  model,
  params,
  snapshot,
  monitorModeEnabled,
  onToggleMonitorMode,
  onChangeNumCtx,
  onToggleRulesEnabled,
  onToggleToolsEnabled,
  onToggleContextItem,
  onToggleSkill,
}: ContextMonitorModalProps) {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!open) return null;

  const { breakdown, numCtx, totalEstimatedTokens, remainingTokens, utilizationPct, status } =
    snapshot;

  const pctOfWindow = (tokens: number) =>
    Math.min(100, (tokens / Math.max(1, numCtx)) * 100);

  const brainRulesTokens = breakdown.brainTokens + breakdown.rulesTokens;
  const skillsToolsTokens =
    breakdown.skillsTokens + breakdown.toolsTokens + breakdown.threadPromptTokens;
  const historyDraftTokens = breakdown.historyTokens + breakdown.draftTokens;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(snapshot.effectiveSystemPrompt);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B0F17]/45 dark:bg-black/65 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-monitor-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/95 dark:bg-[#1E0A11]/95 backdrop-blur-xl shadow-[0_24px_64px_rgba(43,15,23,0.28)]"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Gauge className="h-5 w-5 text-[#6B1D2F] dark:text-[#E6B8A2] shrink-0" />
            <div className="min-w-0">
              <h2
                id="context-monitor-title"
                className="text-base font-semibold text-[#2B0F17] dark:text-[#FAF5EC] truncate"
              >
                Context Window Monitor
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] truncate">
                {project.name} · {model}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleMonitorMode}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                monitorModeEnabled
                  ? 'border-[#6B1D2F]/40 bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC]'
                  : 'border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#2A1019]/80 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#381622]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{monitorModeEnabled ? 'Live Bar Pinned' : 'Pin Live Bar'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close context monitor"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#6B1D2F]/15 dark:border-[#F3E7D8]/16 text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#2B0F17] dark:hover:text-[#FAF5EC]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status Warning Banner if Elevated / Critical */}
          {status !== 'healthy' && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
                status === 'critical'
                  ? 'border-[#9E1B32]/30 bg-[#9E1B32]/8 dark:border-[#F06B82]/30 dark:bg-[#9E1B32]/20 text-[#7A1326] dark:text-[#FBC2CB]'
                  : 'border-[#B45309]/30 bg-[#B45309]/8 dark:border-[#F59E0B]/30 dark:bg-[#B45309]/20 text-[#7C3507] dark:text-[#FDE68A]'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                {status === 'critical'
                  ? 'Context window is nearly full. Ollama may truncate earlier messages unless you raise num_ctx or disable unused resource files below.'
                  : 'Context usage is above 70%. Consider monitoring heavy resource files or raising num_ctx for long threads.'}
              </div>
            </div>
          )}

          {/* Primary Utilization Meter + KPI Row */}
          <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/75 dark:bg-[#16080D]/65 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE]">
                  Estimated Prompt Footprint · {snapshot.statusLabel}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#2B0F17] dark:text-[#FAF5EC]">
                    ~{totalEstimatedTokens.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    / {numCtx.toLocaleString()} tokens ({utilizationPct}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="monitor-num-ctx"
                  className="text-xs font-medium text-[#6E4A53] dark:text-[#CEB8AE]"
                >
                  num_ctx
                </label>
                <select
                  id="monitor-num-ctx"
                  value={params.numCtx}
                  onChange={(e) => onChangeNumCtx(Number(e.target.value))}
                  className="h-8 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/85 dark:bg-[#230D14]/85 px-2 text-xs font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                >
                  {CTX_OPTIONS.map((val) => (
                    <option key={val} value={val}>
                      {val.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stacked Segmented Context Bar */}
            <div className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#6B1D2F]/10 dark:bg-[#F3E7D8]/10">
                {brainRulesTokens > 0 && (
                  <div
                    title={`Brain & rules.md: ~${brainRulesTokens.toLocaleString()} tokens`}
                    className="h-full bg-[#6B1D2F] dark:bg-[#9E2A45] transition-all duration-200"
                    style={{ width: `${pctOfWindow(brainRulesTokens)}%` }}
                  />
                )}
                {breakdown.resourcesTokens > 0 && (
                  <div
                    title={`Resource files: ~${breakdown.resourcesTokens.toLocaleString()} tokens`}
                    className="h-full bg-[#9E3B4D] dark:bg-[#C96B7D] transition-all duration-200"
                    style={{ width: `${pctOfWindow(breakdown.resourcesTokens)}%` }}
                  />
                )}
                {skillsToolsTokens > 0 && (
                  <div
                    title={`Skills, tools & thread instructions: ~${skillsToolsTokens.toLocaleString()} tokens`}
                    className="h-full bg-[#C7826B] dark:bg-[#E6B8A2] transition-all duration-200"
                    style={{ width: `${pctOfWindow(skillsToolsTokens)}%` }}
                  />
                )}
                {historyDraftTokens > 0 && (
                  <div
                    title={`Chat history & draft: ~${historyDraftTokens.toLocaleString()} tokens`}
                    className="h-full bg-[#4D1422] dark:bg-[#F3E7D8] transition-all duration-200"
                    style={{ width: `${pctOfWindow(historyDraftTokens)}%` }}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#CEB8AE]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#6B1D2F] dark:bg-[#9E2A45]" />
                  Brain &amp; Rules: ~{formatTokenCount(brainRulesTokens)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#9E3B4D] dark:bg-[#C96B7D]" />
                  Resources: ~{formatTokenCount(breakdown.resourcesTokens)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#C7826B] dark:bg-[#E6B8A2]" />
                  Skills &amp; Tools: ~{formatTokenCount(skillsToolsTokens)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#4D1422] dark:bg-[#F3E7D8]" />
                  History &amp; Draft: ~{formatTokenCount(historyDraftTokens)}
                </span>
                <span className="ml-auto">
                  Remaining: ~{remainingTokens.toLocaleString()} tok
                </span>
              </div>
            </div>

            {/* Real Ollama Reported Telemetry (when at least 1 reply completed) */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-3 sm:grid-cols-4">
              <div>
                <div className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                  Ollama Prompt Eval
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0]">
                  {snapshot.lastReportedPromptTokens !== undefined
                    ? `${snapshot.lastReportedPromptTokens.toLocaleString()} tok`
                    : 'No turn yet'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                  Last Reply Eval
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0]">
                  {snapshot.lastReportedEvalTokens !== undefined
                    ? `${snapshot.lastReportedEvalTokens.toLocaleString()} tok`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                  Throughput
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0]">
                  {snapshot.lastReportedTokensPerSec !== undefined
                    ? `${snapshot.lastReportedTokensPerSec.toFixed(1)} tok/s`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                  Turn Latency
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#2B0F17] dark:text-[#F5ECE0]">
                  {snapshot.lastReportedTotalMs !== undefined
                    ? `${(snapshot.lastReportedTotalMs / 1000).toFixed(2)}s`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Layer Breakdown & Quick Pruning Controls */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* System & Rule Layers */}
            <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#16080D]/55 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC]">
                <Layers className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>System Layers</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">Project Brain</span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.brainTokens.toLocaleString()} tok
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <label className="flex items-center gap-2 cursor-pointer text-[#4D1422] dark:text-[#E8DAD0]">
                    <input
                      type="checkbox"
                      checked={project.rulesEnabled}
                      onChange={(e) => onToggleRulesEnabled(e.target.checked)}
                      className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                    />
                    <span>Rules (rules.md)</span>
                  </label>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    {project.rulesEnabled
                      ? `~${breakdown.rulesTokens.toLocaleString()} tok`
                      : 'Paused'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <label className="flex items-center gap-2 cursor-pointer text-[#4D1422] dark:text-[#E8DAD0]">
                    <input
                      type="checkbox"
                      checked={params.toolsEnabled}
                      onChange={(e) => onToggleToolsEnabled(e.target.checked)}
                      className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                    />
                    <span>Tool Schemas ({breakdown.toolsCount} active)</span>
                  </label>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    {params.toolsEnabled
                      ? `~${breakdown.toolsTokens.toLocaleString()} tok`
                      : 'Off'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">
                    Thread Instructions
                  </span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.threadPromptTokens.toLocaleString()} tok
                  </span>
                </div>
              </div>
            </div>

            {/* Conversation History & Draft */}
            <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#16080D]/55 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC]">
                <MessageSquare className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Conversation History &amp; Draft</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">User Prompts</span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.userHistoryTokens.toLocaleString()} tok
                    {breakdown.imageCount > 0 ? ` (${breakdown.imageCount} img)` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">
                    Assistant Replies
                  </span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.assistantHistoryTokens.toLocaleString()} tok
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1 border-b border-[#6B1D2F]/8 dark:border-[#F3E7D8]/8">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">
                    Tool Call Results
                  </span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.toolHistoryTokens.toLocaleString()} tok
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[#4D1422] dark:text-[#E8DAD0]">
                    Unsent Composer Draft
                  </span>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                    ~{breakdown.draftTokens.toLocaleString()} tok
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggleable Resource Files */}
          <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#16080D]/55 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC]">
                <FileText className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Injected Resource Files</span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                ~{breakdown.resourcesTokens.toLocaleString()} tok active
              </span>
            </div>

            {snapshot.resources.length === 0 ? (
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                No resource files attached to {project.name}.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {snapshot.resources.map((res) => (
                  <label
                    key={res.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs hover:bg-[#6B1D2F]/6 dark:hover:bg-[#F3E7D8]/6 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={res.enabled}
                        onChange={() => onToggleContextItem(res.id)}
                        className="accent-[#6B1D2F] dark:accent-[#E6B8A2] shrink-0"
                      />
                      <span
                        className={`truncate ${
                          res.enabled
                            ? 'text-[#2B0F17] dark:text-[#F5ECE0] font-medium'
                            : 'text-[#8E646F] dark:text-[#A98F95] line-through'
                        }`}
                      >
                        {res.title}
                      </span>
                      {res.filename && (
                        <span className="hidden sm:inline truncate font-mono text-[11px] text-[#6E4A53] dark:text-[#C5AE9F]">
                          {res.filename}
                        </span>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F] shrink-0">
                      ~{res.tokens.toLocaleString()} tok
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Toggleable Skills */}
          <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#16080D]/55 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC]">
                <Wrench className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Active Project Skills</span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                ~{breakdown.skillsTokens.toLocaleString()} tok active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {snapshot.skills.map((skill) => (
                <label
                  key={skill.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-[#6B1D2F]/6 dark:hover:bg-[#F3E7D8]/6 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={() => onToggleSkill(skill.id)}
                      className="accent-[#6B1D2F] dark:accent-[#E6B8A2] shrink-0"
                    />
                    <span
                      className={`truncate ${
                        skill.enabled
                          ? 'text-[#2B0F17] dark:text-[#F5ECE0] font-medium'
                          : 'text-[#8E646F] dark:text-[#A98F95]'
                      }`}
                    >
                      {skill.name}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[#6E4A53] dark:text-[#C5AE9F] shrink-0">
                    ~{skill.tokens}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Effective Composed System Prompt Inspector */}
          <div className="rounded-xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#16080D]/55 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPromptPreview((v) => !v)}
                aria-expanded={showPromptPreview}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#3A101B] dark:text-[#FAF5EC] hover:underline"
              >
                {showPromptPreview ? (
                  <ChevronDown className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                )}
                <Sliders className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
                <span>Composed System Prompt Payload</span>
                <span className="font-mono font-normal tabular-nums text-[#6E4A53] dark:text-[#C5AE9F]">
                  ({snapshot.effectiveSystemPrompt.length.toLocaleString()} chars)
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopyPrompt}
                disabled={!snapshot.effectiveSystemPrompt}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 disabled:opacity-40"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {showPromptPreview && (
              <pre className="max-h-56 overflow-auto rounded-lg border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 bg-white/80 dark:bg-[#120509] p-3 text-xs font-mono text-[#2B0F17] dark:text-[#E8DAD0] whitespace-pre-wrap break-words">
                {snapshot.effectiveSystemPrompt || '(Empty system prompt)'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
