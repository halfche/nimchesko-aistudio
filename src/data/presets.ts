import type {
  Conversation,
  ModelParameters,
  MotifId,
  SkillModule,
  SystemConnector,
  WorkspaceProject,
} from '../types/ollama';

export const DEFAULT_MODEL_PARAMS: ModelParameters = {
  temperature: 0.7,
  topP: 0.9,
  numCtx: 16384,
  keepAlive: '15m',
  jsonMode: false,
  thinkMode: true,
  toolsEnabled: true,
};

export const DEFAULT_SKILLS: SkillModule[] = [
  {
    id: 'skill-systems-architect',
    name: 'Systems & API Integration',
    category: 'Architecture',
    description:
      'Guides local models to invoke connected tools and cite exact live payloads.',
    instructions:
      'When an external system connector or tool is available and relevant to the user question, invoke the appropriate tool first instead of guessing live data. Summarize the exact data returned by the system clearly.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-code-reviewer',
    name: 'Senior Code Reviewer',
    category: 'Engineering',
    description:
      'Focuses on correctness, edge cases, security, and minimal fixes.',
    instructions:
      'When reviewing or writing code: check for edge cases, race conditions, input validation, and resource cleanup. Provide concrete, runnable TypeScript or Python examples rather than abstract pseudocode.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-structured-output',
    name: 'Structured Output',
    category: 'Workflow',
    description:
      'Produces concise tables, action plans, and clean JSON payloads.',
    instructions:
      'Keep explanations crisp and scannable. Use Markdown tables for comparisons and valid JSON blocks when returning structured payloads.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-concise-mentor',
    name: 'Direct Technical Clarity',
    category: 'Communication',
    description:
      'Prioritizes direct answers, explicit assumptions, and zero fluff.',
    instructions:
      'Answer directly with clear technical reasoning. State assumptions explicitly, keep examples runnable, and avoid filler commentary.',
    enabled: true,
    builtIn: true,
  },
];

export const DEFAULT_CONNECTORS: SystemConnector[] = [
  {
    id: 'conn-datetime',
    name: 'get_current_datetime',
    label: 'Local Clock & Timezone',
    description:
      'Returns the current local date, time, ISO timestamp, and timezone from the user browser.',
    kind: 'builtin',
    builtinId: 'current_datetime',
    parameters: [],
    enabled: true,
  },
  {
    id: 'conn-math',
    name: 'evaluate_math',
    label: 'Deterministic Math',
    description:
      'Evaluates arithmetic and Math.* expressions accurately instead of estimating calculations.',
    kind: 'builtin',
    builtinId: 'evaluate_math',
    parameters: [
      {
        name: 'expression',
        type: 'string',
        description: 'Arithmetic expression to compute, e.g. "(1240 * 1.08) / 12"',
        required: true,
      },
    ],
    enabled: true,
  },
  {
    id: 'conn-http-fetch',
    name: 'fetch_http_json',
    label: 'HTTP GET JSON Reader',
    description:
      'Fetches JSON or text from an HTTP/HTTPS endpoint (must permit browser CORS).',
    kind: 'builtin',
    builtinId: 'fetch_url_json',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'Full http:// or https:// URL to fetch',
        required: true,
      },
    ],
    enabled: false,
  },
  {
    id: 'conn-template-webhook',
    name: 'trigger_system_webhook',
    label: 'Webhook / n8n Bridge',
    description:
      'Sends a structured event payload to a local or remote webhook endpoint (supports {{env.KEY}} variables).',
    kind: 'http',
    method: 'POST',
    url: '{{env.BRIDGE_URL}}/webhook/local-action',
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    bodyTemplate: '{\n  "action": "{{action}}",\n  "payload": "{{payload}}"\n}',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Name of the automation or workflow action to run',
        required: true,
      },
      {
        name: 'payload',
        type: 'string',
        description: 'Details or parameters for the action',
        required: true,
      },
    ],
    enabled: false,
  },
  {
    id: 'conn-template-rag',
    name: 'search_local_knowledge',
    label: 'Local Knowledge Search',
    description:
      'Queries a local RAG / vector search HTTP endpoint (Qdrant, Chroma, or Express API) for relevant documents.',
    kind: 'http',
    method: 'GET',
    url: 'http://localhost:8000/search?q={{query}}&limit={{limit}}',
    headersJson: '{}',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Natural language search query',
        required: true,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of matching chunks to return',
        required: false,
      },
    ],
    enabled: false,
  },
];

export function createConversation(model = ''): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New chat',
    model,
    systemPrompt: '',
    messages: [],
    updatedAt: Date.now(),
  };
}

function cloneSkills(enableReviewer = false): SkillModule[] {
  return DEFAULT_SKILLS.map((s) => ({
    ...s,
    enabled: enableReviewer && s.id === 'skill-code-reviewer' ? true : s.enabled,
  }));
}

function cloneConnectors(): SystemConnector[] {
  return DEFAULT_CONNECTORS.map((c) => ({
    ...c,
    parameters: c.parameters.map((p) => ({ ...p })),
  }));
}

export function createWorkspaceProject(options: {
  id?: string;
  name: string;
  description?: string;
  motif?: MotifId;
  defaultModel?: string;
  brainPrompt?: string;
  rulesMarkdown?: string;
  rulesEnabled?: boolean;
  baseUrl?: string;
  params?: ModelParameters;
  skills?: SkillModule[];
  connectors?: SystemConnector[];
  conversations?: Conversation[];
}): WorkspaceProject {
  const model = options.defaultModel ?? '';
  const initialConversations =
    options.conversations && options.conversations.length > 0
      ? options.conversations
      : [createConversation(model)];

  return {
    id: options.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: options.name,
    description:
      options.description ||
      'Isolated workspace with dedicated history, brain instructions, rules.md, resource files, and environment.',
    motif: options.motif || 'persepolis',
    defaultModel: model,
    brainPrompt:
      options.brainPrompt ??
      'You operate strictly within this project workspace. Ground answers in the project brain, rules.md, resource files, and active connectors.',
    rulesMarkdown:
      options.rulesMarkdown ??
      `# ${options.name} Rules\n\n- Keep answers concise, accurate, and grounded in attached project resources.\n- State assumptions clearly before proposing code or system changes.\n- Prefer project environment variables and enabled tools over guessing.`,
    rulesEnabled: options.rulesEnabled ?? true,
    baseUrl: options.baseUrl || 'http://localhost:11434',
    params: options.params ? { ...options.params } : { ...DEFAULT_MODEL_PARAMS },
    skills: options.skills || cloneSkills(false),
    connectors: options.connectors || cloneConnectors(),
    contextItems: [],
    prompts: [
      {
        id: `prompt-${Date.now()}-1`,
        title: 'Analyze Resource Context',
        category: 'Analysis',
        kind: 'query',
        content:
          'Review the active resource files and rules.md in this project, summarize key constraints, and list the top 3 concrete next steps.',
        updatedAt: Date.now(),
      },
      {
        id: `prompt-${Date.now()}-2`,
        title: 'Strict Concise Architect',
        category: 'Persona',
        kind: 'system',
        content:
          'Respond as a concise senior systems engineer. Lead with the exact solution, list trade-offs in 3 bullets max, and avoid boilerplate.',
        updatedAt: Date.now(),
      },
    ],
    envVars: [
      {
        id: `env-${Date.now()}-1`,
        key: 'BRIDGE_URL',
        value: 'http://localhost:5678',
      },
    ],
    folders: [],
    conversations: initialConversations,
    activeConversationId: initialConversations[0].id,
    updatedAt: Date.now(),
  };
}

export function createInitialProjects(): WorkspaceProject[] {
  const general = createWorkspaceProject({
    id: 'proj-general',
    name: 'General Studio',
    description: 'Primary isolated workspace for everyday local model sessions, comparisons, and prototyping.',
    motif: 'persepolis',
    defaultModel: '',
    brainPrompt:
      'You are a thoughtful, precise AI engineering partner inside the General Studio project.',
    rulesMarkdown:
      '# General Studio Rules\n\n- Lead with direct answers and runnable examples.\n- Ask clarifying questions only when requirements are genuinely ambiguous.\n- Keep formatting clean with Markdown headings and code blocks.',
  });

  const engineering = createWorkspaceProject({
    id: 'proj-systems',
    name: 'Systems & APIs',
    description:
      'Isolated engineering environment for backend integrations, tool schemas, and local services.',
    motif: 'azadi',
    defaultModel: '',
    brainPrompt:
      'You are a senior systems architect. Focus on reliable API contracts, clean TypeScript/Python code, and explicit error handling.',
    rulesMarkdown:
      '# Systems & APIs Rules\n\n- Validate inputs and handle network/timeout errors explicitly.\n- Never hardcode secrets; reference project environment variables like `{{env.BRIDGE_URL}}`.\n- Call enabled system connectors instead of fabricating live outputs.',
    skills: cloneSkills(true),
  });

  engineering.contextItems = [
    {
      id: 'ctx-sys-1',
      title: 'Local Ollama Runtime Target',
      filename: 'ollama-runtime.md',
      source: 'file',
      sizeBytes: 132,
      content:
        'Local models running via Ollama on port 11434 or imported from local GGUF/Modelfile weights. Use /api/chat for NDJSON streaming and function tool calling.',
      enabled: true,
      updatedAt: Date.now(),
    },
  ];
  engineering.prompts = [
    {
      id: 'prompt-sys-1',
      title: 'Design Endpoint Contract',
      category: 'Architecture',
      kind: 'query',
      content:
        'Design a REST endpoint contract (request body, validation rules, error codes, and TypeScript types) aligned with our project resources and rules.md.',
      updatedAt: Date.now(),
    },
    {
      id: 'prompt-sys-2',
      title: 'Audit Connector Payload',
      category: 'Review',
      kind: 'query',
      content:
        'Review our current system connector configuration and suggest edge-case safeguards, retry behavior, and schema improvements.',
      updatedAt: Date.now(),
    },
    {
      id: 'prompt-sys-3',
      title: 'Production Security Reviewer',
      category: 'Persona',
      kind: 'system',
      content:
        'Act as a strict security & reliability reviewer. Flag injection risks, missing error handling, and unvalidated external inputs before suggesting improvements.',
      updatedAt: Date.now(),
    },
  ];
  engineering.envVars = [
    {
      id: 'env-sys-1',
      key: 'BRIDGE_URL',
      value: 'http://localhost:4000',
    },
    {
      id: 'env-sys-2',
      key: 'ENV_PROFILE',
      value: 'local-dev',
    },
  ];

  return [general, engineering];
}
