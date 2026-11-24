import type { Conversation, WorkspaceProject } from '../types/ollama';
import { buildOllamaToolsSchema, composeSystemPrompt } from './ollamaClient';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10000 ? 1 : 2).replace(/\.?0+$/, '')}k`;
  }
  return tokens.toLocaleString();
}

export interface ContextLayerBreakdown {
  brainTokens: number;
  brainChars: number;
  rulesTokens: number;
  rulesChars: number;
  resourcesTokens: number;
  resourcesChars: number;
  skillsTokens: number;
  skillsChars: number;
  toolsTokens: number;
  toolsCount: number;
  threadPromptTokens: number;
  historyTokens: number;
  userHistoryTokens: number;
  assistantHistoryTokens: number;
  toolHistoryTokens: number;
  imageCount: number;
  draftTokens: number;
}

export interface ResourceContextMetric {
  id: string;
  title: string;
  filename?: string;
  enabled: boolean;
  chars: number;
  tokens: number;
}

export interface SkillContextMetric {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  chars: number;
  tokens: number;
}

export interface ContextSnapshot {
  numCtx: number;
  totalEstimatedTokens: number;
  systemLayerTokens: number;
  remainingTokens: number;
  utilizationPct: number;
  status: 'healthy' | 'elevated' | 'critical';
  statusLabel: string;
  effectiveSystemPrompt: string;
  breakdown: ContextLayerBreakdown;
  resources: ResourceContextMetric[];
  skills: SkillContextMetric[];
  lastReportedPromptTokens?: number;
  lastReportedEvalTokens?: number;
  lastReportedTokensPerSec?: number;
  lastReportedTotalMs?: number;
}

export function computeContextSnapshot(
  project: WorkspaceProject,
  conversation: Conversation,
  draftInput = ''
): ContextSnapshot {
  const numCtx = Math.max(1024, project.params.numCtx || 16384);

  const brainText = project.brainPrompt.trim();
  const brainTokens = estimateTokens(brainText);

  const rulesText =
    project.rulesEnabled && project.rulesMarkdown.trim()
      ? project.rulesMarkdown.trim()
      : '';
  const rulesTokens = estimateTokens(rulesText);

  const resources: ResourceContextMetric[] = project.contextItems.map((item) => {
    const chars = item.content.trim().length;
    return {
      id: item.id,
      title: item.title || item.filename || 'Resource',
      filename: item.filename,
      enabled: item.enabled,
      chars,
      tokens: estimateTokens(item.content.trim()),
    };
  });

  const enabledResources = resources.filter((r) => r.enabled);
  const resourcesTokens = enabledResources.reduce((acc, r) => acc + r.tokens, 0);
  const resourcesChars = enabledResources.reduce((acc, r) => acc + r.chars, 0);

  const skills: SkillContextMetric[] = project.skills.map((skill) => {
    const chars = skill.instructions.trim().length;
    return {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      enabled: skill.enabled,
      chars,
      tokens: estimateTokens(skill.instructions.trim()),
    };
  });

  const enabledSkills = skills.filter((s) => s.enabled);
  const skillsTokens = enabledSkills.reduce((acc, s) => acc + s.tokens, 0);
  const skillsChars = enabledSkills.reduce((acc, s) => acc + s.chars, 0);

  const activeTools = project.params.toolsEnabled
    ? buildOllamaToolsSchema(project.connectors)
    : [];
  const toolsJson = activeTools.length > 0 ? JSON.stringify(activeTools) : '';
  const toolsTokens = estimateTokens(toolsJson);

  const threadPromptTokens = estimateTokens(conversation.systemPrompt.trim());

  let userHistoryTokens = 0;
  let assistantHistoryTokens = 0;
  let toolHistoryTokens = 0;
  let imageCount = 0;

  let lastReportedPromptTokens: number | undefined;
  let lastReportedEvalTokens: number | undefined;
  let lastReportedTokensPerSec: number | undefined;
  let lastReportedTotalMs: number | undefined;

  for (const msg of conversation.messages) {
    if (msg.role === 'system') continue;
    const msgTokens = estimateTokens(msg.content) + 4; // role + framing overhead
    if (msg.role === 'user') {
      userHistoryTokens += msgTokens;
      if (msg.images && msg.images.length > 0) {
        imageCount += msg.images.length;
        // Multimodal vision tiles overhead approximation per image
        userHistoryTokens += msg.images.length * 256;
      }
    } else if (msg.role === 'assistant') {
      assistantHistoryTokens += msgTokens;
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantHistoryTokens += estimateTokens(JSON.stringify(msg.toolCalls));
      }
      if (msg.metrics?.promptEvalCount !== undefined) {
        lastReportedPromptTokens = msg.metrics.promptEvalCount;
        lastReportedEvalTokens = msg.metrics.evalCount;
        lastReportedTokensPerSec = msg.metrics.tokensPerSecond;
        lastReportedTotalMs = msg.metrics.totalDurationMs;
      }
    } else if (msg.role === 'tool') {
      toolHistoryTokens += msgTokens;
    }
  }

  const historyTokens =
    userHistoryTokens + assistantHistoryTokens + toolHistoryTokens;
  const draftTokens = estimateTokens(draftInput.trim());

  const effectiveSystemPrompt = composeSystemPrompt(
    conversation.systemPrompt,
    project.skills,
    {
      projectName: project.name,
      brainPrompt: project.brainPrompt,
      rulesMarkdown: project.rulesMarkdown,
      rulesEnabled: project.rulesEnabled,
      contextItems: project.contextItems,
      envVars: project.envVars,
    }
  );

  const systemLayerTokens =
    brainTokens +
    rulesTokens +
    resourcesTokens +
    skillsTokens +
    toolsTokens +
    threadPromptTokens;

  const totalEstimatedTokens = systemLayerTokens + historyTokens + draftTokens;
  const remainingTokens = Math.max(0, numCtx - totalEstimatedTokens);
  const utilizationPct = Math.min(
    100,
    Math.round((totalEstimatedTokens / numCtx) * 100)
  );

  let status: 'healthy' | 'elevated' | 'critical' = 'healthy';
  let statusLabel = 'Healthy';
  if (utilizationPct >= 90) {
    status = 'critical';
    statusLabel = 'Near Limit';
  } else if (utilizationPct >= 70) {
    status = 'elevated';
    statusLabel = 'Elevated';
  }

  return {
    numCtx,
    totalEstimatedTokens,
    systemLayerTokens,
    remainingTokens,
    utilizationPct,
    status,
    statusLabel,
    effectiveSystemPrompt,
    breakdown: {
      brainTokens,
      brainChars: brainText.length,
      rulesTokens,
      rulesChars: rulesText.length,
      resourcesTokens,
      resourcesChars,
      skillsTokens,
      skillsChars,
      toolsTokens,
      toolsCount: activeTools.length,
      threadPromptTokens,
      historyTokens,
      userHistoryTokens,
      assistantHistoryTokens,
      toolHistoryTokens,
      imageCount,
      draftTokens,
    },
    resources,
    skills,
    lastReportedPromptTokens,
    lastReportedEvalTokens,
    lastReportedTokensPerSec,
    lastReportedTotalMs,
  };
}
