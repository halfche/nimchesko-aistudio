import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  FileUp,
  Play,
  Plus,
  Trash2,
  Wrench,
  BookOpen,
  PlugZap,
  Pencil,
} from 'lucide-react';
import type {
  ConnectorParameter,
  ProjectContextItem,
  ProjectEnvVar,
  SkillModule,
  SystemConnector,
} from '../types/ollama';
import {
  buildOllamaToolsSchema,
  composeSystemPrompt,
  executeSystemConnector,
} from '../services/ollamaClient';
import { CodeSnippetBlock } from './CodeSnippetBlock';
import { IsfahanDomeMotif, PersepolisMotif } from './PersianMotifs';

interface SkillsAndConnectorsViewProps {
  projectName: string;
  brainPrompt: string;
  rulesMarkdown: string;
  rulesEnabled: boolean;
  contextItems: ProjectContextItem[];
  envVars: ProjectEnvVar[];
  skills: SkillModule[];
  onChangeSkills: (skills: SkillModule[]) => void;
  connectors: SystemConnector[];
  onChangeConnectors: (connectors: SystemConnector[]) => void;
  toolsEnabled: boolean;
  onToggleToolsEnabled: (enabled: boolean) => void;
  baseSystemPrompt: string;
  model: string;
  onBackToChat: () => void;
}

type SectionTab = 'skills' | 'connectors' | 'bridge';

const EMPTY_SKILL: Omit<SkillModule, 'id'> = {
  name: '',
  category: 'Custom',
  description: '',
  instructions: '',
  enabled: true,
};

function createEmptyConnector(): Omit<SystemConnector, 'id'> {
  return {
    name: '',
    label: '',
    description: '',
    kind: 'http',
    method: 'POST',
    url: 'http://localhost:4000/api/action',
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    bodyTemplate: '{\n  "query": "{{query}}"\n}',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Input value passed by Gemma 4',
        required: true,
      },
    ],
    enabled: true,
  };
}

export function SkillsAndConnectorsView({
  projectName,
  brainPrompt,
  rulesMarkdown,
  rulesEnabled,
  contextItems,
  envVars,
  skills,
  onChangeSkills,
  connectors,
  onChangeConnectors,
  toolsEnabled,
  onToggleToolsEnabled,
  baseSystemPrompt,
  model,
  onBackToChat,
}: SkillsAndConnectorsViewProps) {
  const [subTab, setSubTab] = useState<SectionTab>('skills');

  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [skillDraft, setSkillDraft] = useState<Omit<SkillModule, 'id'>>(EMPTY_SKILL);
  const skillFileRef = useRef<HTMLInputElement>(null);

  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [showConnForm, setShowConnForm] = useState(false);
  const [connDraft, setConnDraft] = useState<Omit<SystemConnector, 'id'>>(
    createEmptyConnector
  );

  const [testingConnId, setTestingConnId] = useState<string | null>(null);
  const [testArgsJson, setTestArgsJson] = useState('{}');
  const [testOutput, setTestOutput] = useState<{
    ok: boolean;
    durationMs: number;
    output: string;
  } | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const activeSkillsCount = skills.filter((s) => s.enabled).length;
  const activeConnectorsCount = connectors.filter((c) => c.enabled).length;
  const compiledPrompt = composeSystemPrompt(baseSystemPrompt, skills, {
    projectName,
    brainPrompt,
    rulesMarkdown,
    rulesEnabled,
    contextItems,
    envVars,
  });
  const compiledTools = buildOllamaToolsSchema(connectors);

  const handleToggleSkill = (id: string) => {
    onChangeSkills(
      skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleOpenNewSkill = () => {
    setEditingSkillId(null);
    setSkillDraft(EMPTY_SKILL);
    setShowSkillForm(true);
  };

  const handleEditSkill = (skill: SkillModule) => {
    setEditingSkillId(skill.id);
    setSkillDraft({
      name: skill.name,
      category: skill.category,
      description: skill.description,
      instructions: skill.instructions,
      enabled: skill.enabled,
      builtIn: skill.builtIn,
    });
    setShowSkillForm(true);
  };

  const handleSaveSkill = () => {
    if (!skillDraft.name.trim() || !skillDraft.instructions.trim()) return;
    if (editingSkillId) {
      onChangeSkills(
        skills.map((s) =>
          s.id === editingSkillId ? { ...skillDraft, id: editingSkillId } : s
        )
      );
    } else {
      onChangeSkills([
        {
          ...skillDraft,
          id: `skill-${Date.now()}`,
        },
        ...skills,
      ]);
    }
    setShowSkillForm(false);
    setEditingSkillId(null);
    setSkillDraft(EMPTY_SKILL);
  };

  const handleDeleteSkill = (id: string) => {
    onChangeSkills(skills.filter((s) => s.id !== id));
  };

  const handleImportSkillMarkdown = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const cleanedName = file.name.replace(/\.(md|txt)$/i, '').replace(/[-_]+/g, ' ');
    const headingMatch = /^#\s+(.+)$/m.exec(text);
    const skillName = headingMatch ? headingMatch[1].trim() : cleanedName;
    const imported: SkillModule = {
      id: `skill-${Date.now()}`,
      name: skillName || 'Imported Skill',
      category: 'Imported',
      description: `Imported from ${file.name}`,
      instructions: text.trim(),
      enabled: true,
    };
    onChangeSkills([imported, ...skills]);
  };

  const handleToggleConnector = (id: string) => {
    onChangeConnectors(
      connectors.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleOpenNewConnector = () => {
    setEditingConnId(null);
    setConnDraft(createEmptyConnector());
    setShowConnForm(true);
  };

  const handleEditConnector = (conn: SystemConnector) => {
    setEditingConnId(conn.id);
    setConnDraft({
      name: conn.name,
      label: conn.label,
      description: conn.description,
      kind: conn.kind,
      builtinId: conn.builtinId,
      method: conn.method || 'POST',
      url: conn.url || '',
      headersJson: conn.headersJson || '{}',
      bodyTemplate: conn.bodyTemplate || '',
      parameters: conn.parameters.map((p) => ({ ...p })),
      enabled: conn.enabled,
    });
    setShowConnForm(true);
  };

  const handleSaveConnector = () => {
    const cleanName = connDraft.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_');
    if (!cleanName || !connDraft.label.trim()) return;

    const record: SystemConnector = {
      ...connDraft,
      id: editingConnId || `conn-${Date.now()}`,
      name: cleanName,
      parameters: connDraft.parameters.filter((p) => p.name.trim()),
    };

    if (editingConnId) {
      onChangeConnectors(
        connectors.map((c) => (c.id === editingConnId ? record : c))
      );
    } else {
      onChangeConnectors([record, ...connectors]);
    }
    setShowConnForm(false);
    setEditingConnId(null);
  };

  const handleDeleteConnector = (id: string) => {
    onChangeConnectors(connectors.filter((c) => c.id !== id));
    if (testingConnId === id) {
      setTestingConnId(null);
      setTestOutput(null);
    }
  };

  const handleAddParam = () => {
    setConnDraft((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { name: '', type: 'string', description: '', required: true },
      ],
    }));
  };

  const handleUpdateParam = (
    idx: number,
    patch: Partial<ConnectorParameter>
  ) => {
    setConnDraft((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  };

  const handleRemoveParam = (idx: number) => {
    setConnDraft((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== idx),
    }));
  };

  const handleOpenTester = (conn: SystemConnector) => {
    if (testingConnId === conn.id) {
      setTestingConnId(null);
      setTestOutput(null);
      return;
    }
    const sample: Record<string, unknown> = {};
    for (const p of conn.parameters) {
      if (p.type === 'number') sample[p.name] = 5;
      else if (p.type === 'boolean') sample[p.name] = true;
      else if (p.name === 'expression') sample[p.name] = '(1250 * 1.15) / 12';
      else if (p.name === 'url') sample[p.name] = 'https://httpbin.org/json';
      else sample[p.name] = 'sample_value';
    }
    setTestingConnId(conn.id);
    setTestArgsJson(JSON.stringify(sample, null, 2));
    setTestOutput(null);
  };

  const handleRunConnectorTest = async (conn: SystemConnector) => {
    setIsRunningTest(true);
    try {
      const parsedArgs = testArgsJson.trim()
        ? (JSON.parse(testArgsJson) as Record<string, unknown>)
        : {};
      const res = await executeSystemConnector(conn, parsedArgs, undefined, envVars);
      setTestOutput(res);
    } catch (err) {
      setTestOutput({
        ok: false,
        durationMs: 0,
        output: JSON.stringify(
          { error: err instanceof Error ? err.message : 'Invalid JSON arguments' },
          null,
          2
        ),
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const expressToolBridgeCode = `// local-system-bridge.ts — Connect local DBs, files, or internal APIs to Gemma 4
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors()); // Allows nimchesko AI studio browser UI to invoke this bridge
app.use(express.json());

// Example 1: Search local SQLite / Postgres / files
app.get('/search', async (req, res) => {
  const query = String(req.query.q || '');
  const limit = Number(req.query.limit || 5);
  res.json({
    query,
    results: [
      { id: 1, title: 'System Runbook', snippet: 'Restart worker with systemctl...' },
    ].slice(0, limit),
  });
});

// Example 2: Execute a local workflow / webhook action
app.post('/api/action', async (req, res) => {
  const { action, payload } = req.body;
  res.json({ accepted: true, action, payload, timestamp: new Date().toISOString() });
});

app.listen(4000, () => console.log('System bridge running on http://localhost:4000'));`;

  return (
    <div className="h-full overflow-y-auto bg-transparent px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pb-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center gap-1 pt-1 text-[#6B1D2F]/80 dark:text-[#E6B8A2]/85">
              <PersepolisMotif className="h-10 w-12" />
              <IsfahanDomeMotif className="h-10 w-12" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2]">
                Project Scope · {projectName}
              </div>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#3A101B] dark:text-[#F5ECE0] [text-wrap:balance]">
                Skills &amp; System Connectors
              </h1>
              <p className="mt-2 text-sm text-[#6E4A53] dark:text-[#CEB8AE] max-w-2xl leading-relaxed">
                Equip <code className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-[#FAF5EC]/80 dark:bg-[#230D14]/80 border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/14 text-[#4D1422] dark:text-[#E6B8A2]">{model}</code> inside {projectName} with isolated skills and live HTTP/REST connectors.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[#6E4A53] dark:text-[#CEB8AE] tabular-nums">
                <span>{activeSkillsCount} active skills</span>
                <span aria-hidden="true">·</span>
                <span>{activeConnectorsCount} connectors</span>
                <span aria-hidden="true">·</span>
                <span>Tools {toolsEnabled ? 'enabled' : 'paused'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Chat</span>
          </button>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#6B1D2F]/7 dark:bg-[#F3E7D8]/7 p-1 border border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10">
            <button
              type="button"
              onClick={() => setSubTab('skills')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'skills'
                  ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                  : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Skills</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('connectors')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'connectors'
                  ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                  : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
              }`}
            >
              <PlugZap className="h-3.5 w-3.5" />
              <span>Connectors</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('bridge')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'bridge'
                  ? 'bg-[#FCF8F2] dark:bg-[#8C253E] text-[#3A101B] dark:text-[#FAF5EC] shadow-xs'
                  : 'text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]'
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Schema &amp; Bridge</span>
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] cursor-pointer">
            <input
              type="checkbox"
              checked={toolsEnabled}
              onChange={(e) => onToggleToolsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[#6B1D2F]/30 accent-[#6B1D2F] dark:accent-[#E6B8A2]"
            />
            <span>Enable tool calling</span>
          </label>
        </div>

        {/* TAB 1: SKILLS LIBRARY */}
        {subTab === 'skills' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                  Behavioral Skills
                </h2>
                <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                  Enabled skills compose automatically into {projectName}&apos;s system prompt for {model}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={skillFileRef}
                  type="file"
                  accept=".md,.txt"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportSkillMarkdown(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => skillFileRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/75 dark:bg-[#230D14]/75 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] transition-colors whitespace-nowrap shrink-0"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Import .md</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewSkill}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Skill</span>
                </button>
              </div>
            </div>

            {showSkillForm && (
              <div className="rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#240D15]/85 backdrop-blur-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    {editingSkillId ? 'Edit Skill' : 'New Skill'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSkillForm(false)}
                    className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Skill Name
                    </label>
                    <input
                      type="text"
                      value={skillDraft.name}
                      onChange={(e) =>
                        setSkillDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder="e.g. Security Auditor"
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={skillDraft.category}
                      onChange={(e) =>
                        setSkillDraft((d) => ({ ...d, category: e.target.value }))
                      }
                      placeholder="Engineering / Support"
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={skillDraft.description}
                    onChange={(e) =>
                      setSkillDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    placeholder="Summary of what this skill enforces..."
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Instructions
                  </label>
                  <textarea
                    rows={4}
                    value={skillDraft.instructions}
                    onChange={(e) =>
                      setSkillDraft((d) => ({ ...d, instructions: e.target.value }))
                    }
                    placeholder="Define rules, tone, output format, or domain expertise..."
                    className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 py-2 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSkillForm(false)}
                    className="h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-4 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSkill}
                    disabled={!skillDraft.name.trim() || !skillDraft.instructions.trim()}
                    className="h-9 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40"
                  >
                    Save Skill
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`rounded-2xl border backdrop-blur-md p-4 transition-colors ${
                    skill.enabled
                      ? 'border-[#6B1D2F]/40 dark:border-[#E6B8A2]/40 bg-[#6B1D2F]/[0.07] dark:bg-[#8C253E]/18'
                      : 'border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                        {skill.category}
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0] truncate">
                        {skill.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSkill(skill.id)}
                      className={`h-8 rounded-xl px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        skill.enabled
                          ? 'bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]'
                          : 'border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]'
                      }`}
                    >
                      {skill.enabled ? 'Active' : 'Enable'}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-[#5C3A42] dark:text-[#CEB8AE] leading-relaxed">
                    {skill.description || skill.instructions.slice(0, 120)}
                  </p>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#6B1D2F]/10 dark:border-[#F3E7D8]/10 pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleEditSkill(skill)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10 hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Compiled System Prompt ({projectName})
              </h3>
              <pre className="max-h-52 overflow-y-auto rounded-2xl border border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65 backdrop-blur-md p-4 text-xs font-mono leading-relaxed text-[#3A101B] dark:text-[#F5ECE0] whitespace-pre-wrap">
                {compiledPrompt || '(No brain prompt, context, or active skills yet)'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: SYSTEM CONNECTORS & TOOLS */}
        {subTab === 'connectors' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                  Connected Systems
                </h2>
                <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5">
                  Enabled connectors are exposed in Ollama&apos;s <code className="font-mono">tools</code> array and can reference <code className="font-mono">{'{{env.KEY}}'}</code> variables.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewConnector}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3.5 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Connector</span>
              </button>
            </div>

            {showConnForm && (
              <div className="rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#240D15]/85 backdrop-blur-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                    {editingConnId ? 'Edit Connector' : 'New HTTP / Webhook Connector'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowConnForm(false)}
                    className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#3A101B] dark:hover:text-[#FAF5EC]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={connDraft.label}
                      onChange={(e) =>
                        setConnDraft((d) => ({ ...d, label: e.target.value }))
                      }
                      placeholder="e.g. Order Status API"
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                      Function Name (snake_case)
                    </label>
                    <input
                      type="text"
                      value={connDraft.name}
                      onChange={(e) =>
                        setConnDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder="e.g. get_order_status"
                      className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                    Description for Gemma 4
                  </label>
                  <input
                    type="text"
                    value={connDraft.description}
                    onChange={(e) =>
                      setConnDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    placeholder="Looks up live customer order status by ID."
                    className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                  />
                </div>

                {connDraft.kind === 'http' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                          Method
                        </label>
                        <select
                          value={connDraft.method || 'POST'}
                          onChange={(e) =>
                            setConnDraft((d) => ({
                              ...d,
                              method: e.target.value as 'GET' | 'POST' | 'PUT',
                            }))
                          }
                          className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-2.5 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                      <div className="sm:col-span-9">
                        <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                          Endpoint URL (supports <code className="font-mono">{'{{param}}'}</code> &amp; <code className="font-mono">{'{{env.KEY}}'}</code>)
                        </label>
                        <input
                          type="url"
                          value={connDraft.url || ''}
                          onChange={(e) =>
                            setConnDraft((d) => ({ ...d, url: e.target.value }))
                          }
                          placeholder="{{env.BRIDGE_URL}}/api/orders/{{order_id}}"
                          className="h-9 w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 text-sm font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                          Headers JSON
                        </label>
                        <textarea
                          rows={3}
                          value={connDraft.headersJson || '{}'}
                          onChange={(e) =>
                            setConnDraft((d) => ({ ...d, headersJson: e.target.value }))
                          }
                          className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 py-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                          Body Template (POST/PUT)
                        </label>
                        <textarea
                          rows={3}
                          value={connDraft.bodyTemplate || ''}
                          onChange={(e) =>
                            setConnDraft((d) => ({ ...d, bodyTemplate: e.target.value }))
                          }
                          placeholder='{"query": "{{query}}"}'
                          className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-3 py-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2]">
                      Input Parameters
                    </span>
                    <button
                      type="button"
                      onClick={handleAddParam}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6B1D2F] dark:text-[#E6B8A2] hover:bg-[#6B1D2F]/8 dark:hover:bg-[#F3E7D8]/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Parameter</span>
                    </button>
                  </div>

                  {connDraft.parameters.length === 0 ? (
                    <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                      No parameters (tool takes empty arguments).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {connDraft.parameters.map((param, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center"
                        >
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) =>
                              handleUpdateParam(idx, { name: e.target.value })
                            }
                            placeholder="param_name"
                            className="sm:col-span-3 h-8 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-2.5 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                          />
                          <select
                            value={param.type}
                            onChange={(e) =>
                              handleUpdateParam(idx, {
                                type: e.target.value as 'string' | 'number' | 'boolean',
                              })
                            }
                            className="sm:col-span-2 h-8 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0]"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                          </select>
                          <input
                            type="text"
                            value={param.description}
                            onChange={(e) =>
                              handleUpdateParam(idx, { description: e.target.value })
                            }
                            placeholder="Parameter description"
                            className="sm:col-span-5 h-8 rounded-lg border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/70 dark:bg-[#16080D]/80 px-2.5 text-xs text-[#2B0F17] dark:text-[#F5ECE0]"
                          />
                          <label className="sm:col-span-1 flex items-center gap-1 text-xs text-[#6E4A53] dark:text-[#CEB8AE]">
                            <input
                              type="checkbox"
                              checked={param.required}
                              onChange={(e) =>
                                handleUpdateParam(idx, { required: e.target.checked })
                              }
                              className="accent-[#6B1D2F] dark:accent-[#E6B8A2]"
                            />
                            <span>Req</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveParam(idx)}
                            aria-label="Remove parameter"
                            className="sm:col-span-1 inline-flex justify-end text-[#6E4A53] dark:text-[#CEB8AE] hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConnForm(false)}
                    className="h-9 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 px-4 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#2F121B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConnector}
                    disabled={!connDraft.name.trim() || !connDraft.label.trim()}
                    className="h-9 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-4 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-40"
                  >
                    Save Connector
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {connectors.map((conn) => {
                const isTesting = testingConnId === conn.id;
                return (
                  <div
                    key={conn.id}
                    className={`rounded-2xl border backdrop-blur-md p-4 transition-colors ${
                      conn.enabled
                        ? 'border-[#6B1D2F]/40 dark:border-[#E6B8A2]/40 bg-[#6B1D2F]/[0.07] dark:bg-[#8C253E]/18'
                        : 'border-[#6B1D2F]/14 dark:border-[#F3E7D8]/12 bg-[#FAF5EC]/65 dark:bg-[#230D14]/65'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E4A53] dark:text-[#C5AE9F]">
                          <span className="font-mono text-[#4D1422] dark:text-[#E6B8A2]">
                            {conn.name}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {conn.kind === 'builtin'
                              ? 'Built-in'
                              : `${conn.method || 'POST'} ${conn.url}`}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                          {conn.label}
                        </h3>
                        <p className="mt-1 text-xs text-[#5C3A42] dark:text-[#CEB8AE] leading-relaxed">
                          {conn.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenTester(conn)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
                        >
                          <Play className="h-3 w-3" />
                          <span>Test</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditConnector(conn)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 px-2.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B] whitespace-nowrap"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleConnector(conn.id)}
                          className={`inline-flex h-8 items-center gap-1 rounded-xl px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                            conn.enabled
                              ? 'bg-[#6B1D2F] dark:bg-[#8C253E] text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49]'
                              : 'border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-[#FCF8F2]/80 dark:bg-[#19080E]/80 text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FCF8F2] dark:hover:bg-[#2F121B]'
                          }`}
                        >
                          {conn.enabled && <Check className="h-3 w-3" />}
                          <span>{conn.enabled ? 'Enabled' : 'Enable'}</span>
                        </button>
                        {conn.kind === 'http' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteConnector(conn.id)}
                            aria-label={`Remove ${conn.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#6E4A53] dark:text-[#CEB8AE] hover:bg-[#6B1D2F]/10 dark:hover:bg-[#F3E7D8]/10 hover:text-[#6B1D2F] dark:hover:text-[#E6B8A2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isTesting && (
                      <div className="mt-4 border-t border-[#6B1D2F]/12 dark:border-[#F3E7D8]/12 pt-3.5 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                              Sample Arguments (JSON)
                            </label>
                            <textarea
                              rows={4}
                              value={testArgsJson}
                              onChange={(e) => setTestArgsJson(e.target.value)}
                              className="w-full rounded-xl border border-[#6B1D2F]/18 dark:border-[#F3E7D8]/16 bg-white/75 dark:bg-[#16080D]/85 px-3 py-2 text-xs font-mono text-[#2B0F17] dark:text-[#F5ECE0] focus:border-[#6B1D2F]/60 dark:focus:border-[#E6B8A2]/50 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void handleRunConnectorTest(conn)}
                              disabled={isRunningTest}
                              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#6B1D2F] dark:bg-[#8C253E] px-3 text-xs font-medium text-[#FAF5EC] hover:bg-[#541524] dark:hover:bg-[#A02D49] disabled:opacity-50"
                            >
                              <Play className="h-3 w-3" />
                              <span>{isRunningTest ? 'Running...' : 'Run Test'}</span>
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-[#4D1422] dark:text-[#E6B8A2] mb-1">
                              <span>Output</span>
                              {testOutput && (
                                <span className="font-mono tabular-nums text-[#6B1D2F] dark:text-[#E6B8A2]">
                                  {testOutput.ok ? 'OK' : 'Error'} · {testOutput.durationMs.toFixed(0)}ms
                                </span>
                              )}
                            </div>
                            <pre className="h-28 overflow-auto rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/14 bg-[#2E0E17]/92 dark:bg-[#19080E]/95 p-2.5 text-xs font-mono text-[#FAF5EC]">
                              {testOutput
                                ? testOutput.output
                                : '// Click Run Test to verify output'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: TOOL SCHEMA & SYSTEM BRIDGE */}
        {subTab === 'bridge' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Active Ollama <code className="font-mono text-base">tools</code> Payload
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5 leading-relaxed">
                This JSON schema is passed to <code className="font-mono">/api/chat</code> inside {projectName} whenever tool calling is enabled.
              </p>
              <CodeSnippetBlock
                code={JSON.stringify(compiledTools, null, 2)}
                language="json"
                filename={`tools-schema (${compiledTools.length} active)`}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#3A101B] dark:text-[#F5ECE0]">
                Local Express Bridge
              </h2>
              <p className="text-xs text-[#6E4A53] dark:text-[#CEB8AE] mt-0.5 leading-relaxed">
                Run this local Express bridge and register its URLs under <strong>Connectors</strong> so Gemma 4 12B can query SQLite, Postgres, files, or internal APIs.
              </p>
              <CodeSnippetBlock
                code={expressToolBridgeCode}
                language="typescript"
                filename="local-system-bridge.ts"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
