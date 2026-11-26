export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModelTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

export interface OllamaTagsResponse {
  models: OllamaModelTag[];
}

export interface OllamaChatMetrics {
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptEvalCount?: number;
  evalCount?: number;
  evalDurationMs?: number;
  tokensPerSecond?: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string; // Full data URL for UI preview
  base64: string; // Raw base64 payload expected by Ollama /api/chat images[]
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  images?: ChatAttachment[];
  toolCalls?: OllamaToolCall[];
  toolName?: string;
  toolDurationMs?: number;
  toolSuccess?: boolean;
  createdAt: number;
  metrics?: OllamaChatMetrics;
  error?: string;
}

export interface ConversationFolder {
  id: string;
  name: string;
  collapsed?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  systemPrompt: string;
  folderId?: string | null;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ModelParameters {
  temperature: number;
  topP: number;
  numCtx: number;
  keepAlive: string;
  jsonMode: boolean;
  thinkMode: boolean;
  toolsEnabled: boolean;
}

export interface SkillModule {
  id: string;
  name: string;
  category: string;
  description: string;
  instructions: string;
  enabled: boolean;
  builtIn?: boolean;
}

export interface ConnectorParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export type ConnectorKind = 'builtin' | 'http';

export interface SystemConnector {
  id: string;
  name: string; // snake_case tool function name exposed to Ollama
  label: string; // Human-readable title
  description: string; // Instructs the local model when & how to call this system
  kind: ConnectorKind;
  builtinId?: 'current_datetime' | 'evaluate_math' | 'fetch_url_json';
  method?: 'GET' | 'POST' | 'PUT';
  url?: string;
  headersJson?: string;
  bodyTemplate?: string;
  parameters: ConnectorParameter[];
  enabled: boolean;
}

export type MotifId = 'shamseh' | 'persepolis' | 'azadi' | 'isfahan' | 'siosepol';

export interface ProjectContextItem {
  id: string;
  title: string;
  filename?: string;
  source?: 'file' | 'note';
  sizeBytes?: number;
  content: string;
  enabled: boolean;
  updatedAt: number;
}

export type PromptKind = 'query' | 'system';

export interface ProjectPrompt {
  id: string;
  title: string;
  category: string;
  kind?: PromptKind;
  content: string;
  updatedAt: number;
}

export interface ProjectEnvVar {
  id: string;
  key: string;
  value: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  motif: MotifId;
  defaultModel: string;
  brainPrompt: string;
  rulesMarkdown: string;
  rulesEnabled: boolean;
  baseUrl: string;
  params: ModelParameters;
  skills: SkillModule[];
  connectors: SystemConnector[];
  contextItems: ProjectContextItem[];
  prompts: ProjectPrompt[];
  envVars: ProjectEnvVar[];
  folders: ConversationFolder[];
  conversations: Conversation[];
  activeConversationId: string;
  updatedAt: number;
}

export type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'error';

export interface ConnectionDiagnostic {
  status: ConnectionStatus;
  models: OllamaModelTag[];
  checkedAt?: number;
  errorTitle?: string;
  errorDetail?: string;
  probableCause?: 'cors_or_pna' | 'unreachable' | 'http_error' | 'invalid_url';
}

export interface ImportedModelProfile {
  id: string;
  name: string;
  sourceType: 'ollama' | 'modelfile' | 'gguf' | 'local-file';
  baseModel?: string;
  fileName?: string;
  fileSizeBytes?: number;
  modelfileContent?: string;
  systemPrompt?: string;
  recommendedNumCtx?: number;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  syncedWithOllama: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OllamaShowResponse {
  modelfile?: string;
  parameters?: string;
  template?: string;
  details?: OllamaModelDetails;
  model_info?: Record<string, unknown>;
}

export type CompareRunStatus =
  | 'queued'
  | 'streaming'
  | 'done'
  | 'error'
  | 'aborted';

export interface CompareModelResult {
  model: string;
  status: CompareRunStatus;
  content: string;
  thinking: string;
  metrics?: OllamaChatMetrics;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface CompareRound {
  id: string;
  prompt: string;
  executionMode: 'sequential' | 'parallel';
  includeProjectBrain: boolean;
  createdAt: number;
  results: CompareModelResult[];
}

export interface WorkspaceSyncBundle {
  schemaVersion: 1;
  exportedAt: number;
  sourcePlatform?: string;
  projects: WorkspaceProject[];
  importedModels: ImportedModelProfile[];
  drafts: Record<string, string>;
}

