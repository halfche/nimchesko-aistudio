# Product Requirements Document (PRD) — `nimchesko AI studio`

**Document Status:** Complete & Aligned With Codebase (`v1.0.0`)  
**Product Name:** `nimchesko AI studio`  
**Repository:** `https://github.com/halfche/nimchesko-aistudio`  
**Maintainer Contact:** `nimchesko@gmail.com`  
**Interactive Guide Entry:** `public/guide.html` (deployed to GitHub Pages root)  

---

## 1. Executive Summary & Vision

**nimchesko AI studio** is a 100% local, model-agnostic AI command center, multi-model comparison workbench, dual-model orchestration pipeline (`Hyper Mode`), and skill/knowledge authoring studio (`Journal & Skills`). It enables individuals and engineers to run, compare, customize, and integrate **any local model**—whether pulled from Ollama, discovered via `/api/tags`, imported from `Modelfile` / `.json` profiles, or streamed straight from local `.gguf`, `.bin`, or `.safetensors` weights—without cloud lock-in, mandatory accounts, Python runtimes, or Docker containers.

The interface uses a distinctive **Burgundy & Cream** dual Light/Dark aesthetic accented by **five custom Iranian architectural vector motifs** (Shamseh, Persepolis, Azadi Tower, Isfahan Dome, and Si-o-se-pol).

---

## 2. Problem Statement

Local LLM users currently face fragmented workflows across existing tools:
1. **CLI-only tools (`ollama` CLI):** Fast and scriptable, but lack visual comparison, project isolation, file attachment inspection, or structured Markdown authoring.
2. **Server-heavy web UIs (`Open WebUI`):** Feature-rich for teams, but require Python/Docker stacks, complex containers, and heavier background services.
3. **Single-model desktop apps (`LM Studio`, `Jan`):** Focus on talking to one active model at a time, lacking multi-model fan-out inside one chat thread, automated side-by-side VRAM-safe sequential comparison, dual-model Architect -> Builder pipelines, or direct Desktop Markdown skill export.
4. **Hardcoded single-model assistants:** Restrict users to a single family instead of letting them bring any local weights or switch models freely per task.

**nimchesko AI studio solves these problems** by delivering a self-contained static web SPA + PWA + zero-setup `.zip` bundle + native Electron desktop suite (`.deb`, `.rpm`, `.pkg.tar.zst`, `.AppImage`, `.tar`, `.tar.zst`, `.exe`, `.pkg`) that connects directly to local Ollama instances and local Desktop folders.

---

## 3. Target Personas & Use Cases

| Persona | Primary Need | Key Studio Modules Used |
| --- | --- | --- |
| **Local AI Tinkerer / Model Collector** | Test multiple GGUF quantizations, HuggingFace models (`hf.co/...`), and Ollama tags side-by-side without guessing which model performs best on local hardware. | `Models & Sync`, `Compare` (Sequential VRAM-safe & Parallel) |
| **Full-Stack / Systems Engineer** | Maintain separate system rules (`rules.md`), codebase resource files, environment variables, and HTTP/webhook tool calls per engineering project. | `Projects`, `Skills & Connectors`, `Chat`, `Context Monitor` |
| **Dual-Model Prompt Architect** | Leverage a smart "Higher" model to write an exhaustive specification and pass it automatically to a fast/lightweight "Lower" builder model, saving clean `.md` specs to Desktop. | `Hyper Mode` (`Desktop/Hyper Mode Markdown Files`) |
| **Workflow & Knowledge Crafter** | Document repeatable `Side A -> Side B` bridges with reference links and attachments, refine them into Markdown skills via a local model, and attach them to active projects. | `Journal & Skills` (`Desktop/Journal & Skill Mode`) |
| **Air-Gapped / Privacy-First User** | Run completely offline on Windows, macOS, or Linux without telemetry, cloud servers, or external databases. | Offline `.zip` (`run-windows.bat` / `run-linux.sh`), PWA, Desktop Installers |

---

## 4. Product Scope & Non-Goals

### In Scope
- Direct communication with local or LAN Ollama HTTP endpoints (`http://localhost:11434` default) using standard browser `fetch` + NDJSON streaming.
- Model-agnostic selection and local weight import (`/api/blobs` + `/api/create`) with zero hardcoded default lock-in.
- Local-first persistence (`localStorage` with quota overflow protection) + portable `.json` sync bundles + local disk mirroring + Desktop folder saving.
- Multilingual static interactive documentation (`public/guide.html` & `README*.md`) in 7 languages (English, Persian, Arabic, German, Spanish, French, Turkish).

### Explicit Non-Goals
- No mandatory cloud backend, user login/OAuth wall, or external SaaS database.
- No telemetry, usage tracking, or remote analytics.
- No Docker daemon requirement for end users.

---

## 5. Product Delivery Phases (Evolution & Architecture Milestones)

The product was engineered across five distinct functional phases:

| Phase | Scope & Deliverables | Key Outcome |
| --- | --- | --- |
| **Phase 1: Core Local Chat & Ollama Bridge** | Initial React + Vite SPA, NDJSON streaming via `/api/chat`, `MarkdownRenderer` + `CodeSnippetBlock`, `<thought>` reasoning collapse, multimodal image attachments, Live Clock & Math tool calling, CORS/Private Network Access diagnostics. | Reliable browser-to-Ollama streaming UI with real metrics (`tok/s`, latency). |
| **Phase 2: Isolated Projects & Workspace Productivity** | Multi-project workspaces (`WorkspaceProject`), `rules.md`, `brainPrompt`, project resource ingestion (`ProjectContextItem`), `SystemConnector` HTTP templates with `{{env.KEY}}`, `ConversationFoldersSidebar`, `QuickPromptsSidebarSection`, `ContextMonitorModal`, auto-save & per-chat drafts, Burgundy & Cream Light/Dark UI + Persian motifs. | Complete isolated "project brains" and context budget control. |
| **Phase 3: Model-Agnostic Refactor & Side-by-Side Compare** | Removed hardcoded Gemma 4 lock-in (`STORAGE_CLEARED_GEMMA_DEFAULT_KEY` migration), built `CompareView` (Parallel & VRAM-safe Sequential execution, `/api/show` inspector, Markdown report export, promote winner to Chat), added direct local `.gguf`/`.bin`/`.safetensors` streaming via incremental FIPS 180-4 SHA-256 `/api/blobs` + `/api/create`, `Modelfile` parser, and Workspace `.json` Sync + ChatGPT `conversations.json` import. | Works equally with *any* local model and benchmarks them fairly side-by-side. |
| **Phase 4: Hyper Mode, Journal & Skills, Multi-Model Chat & Universal Uploads** | Built `HyperModeView` (Higher Architect -> Lower Builder pipeline in selectable output languages + auto-save to `Desktop/Hyper Mode Markdown Files`), built `JournalCreativeView` (`Side A -> Side B` bridges, links, project attach + auto-save to `Desktop/Journal & Skill Mode`), upgraded `ChatView` for **multi-model parallel/sequential fan-out**, enforced **mandatory descriptive chat naming**, and added universal `*/*` file ingestion (`fileUploads.ts`) across all workspaces. | End-to-end orchestration, knowledge capture, multi-model threads, and universal attachments. |
| **Phase 5: Multi-Platform Packaging, Interactive Guide & CI/CD** | Built Electron desktop app (`desktop/main.cjs`, `preload.cjs`), Vite combined `.zip` bundler (`run-windows.bat`, `run-linux.sh`), PWA Workbox offline cache, 7-language `public/guide.html` as GitHub Pages default root, GitHub Actions Windows (`.exe`), macOS (`.pkg`), and hardened sequential Linux packager (`.deb`, `.rpm` with native `rpmbuild` fallback, `.AppImage`, `.tar`, `.tar.zst`, `.pkg.tar.zst`). | Zero-friction web, PWA, portable `.zip`, and native OS distribution. |

---

## 6. Functional Requirements Matrix

| ID | Requirement Area | Detailed Product Requirements |
| --- | --- | --- |
| **FR-01** | **Ollama Connection & Diagnostics** | Normalize URLs (`http://localhost:11434` fallback); probe `GET /api/tags`; classify failures (`invalid_url`, `cors_or_pna`, `http_error`, `unreachable`) with OS-specific remediation commands (`OLLAMA_ORIGINS=*`). |
| **FR-02** | **Model-Agnostic Discovery & Import (`Models & Sync`)** | Auto-discover installed Ollama models; one-click "Import All"; pull tags or `hf.co/<user>/<repo>:<quant>` via `/api/pull`; import custom `Modelfile` or `.json` profiles; hash & stream multi-GB local `.gguf` / `.bin` / `.safetensors` files cleanly via `HEAD /api/blobs/{sha256}` -> `POST /api/blobs/{sha256}` -> `POST /api/create`; inspect via `/api/show`; delete via `/api/delete`. |
| **FR-03** | **Chat Workspace & Multi-Model Fan-Out (`Chat`)** | Support switching primary model plus selecting additional `secondaryModels[]` in a single thread; execute user prompt against all selected models and label each assistant bubble with `modelName` and `tok/s` metrics; enforce mandatory non-default chat naming on new chat creation or first send (with prompt-derived auto-suggestion). |
| **FR-04** | **Side-by-Side Comparison (`Compare`)** | Select 2+ or all local models (Ollama + local profiles); toggle `Sequential` (VRAM-safe) vs `Parallel` execution; optionally include active Project Brain; stream live cards showing status, thinking trace, content, `tok/s`, latency, and token counts; inspect `/api/show`; export Markdown report; send winning response to Chat. |
| **FR-05** | **Dual-Model Orchestration (`Hyper Mode`)** | Create named sessions (`name` required); pick `higherModel` (Architect), `lowerModel` (Builder), and target Markdown output language (`auto`, `fa`, `en`, `ar`, `fr`, `de`, `es`); attach `*/*` files; stream Higher model architectural `.md` spec -> feed spec as context into Lower model -> execute -> auto-save `.md` to `Desktop/Hyper Mode Markdown Files`. |
| **FR-06** | **Journal & Skill Authoring (`Journal & Skills`)** | Create named entries across categories (`Skill Module`, `Model Bridge`, `Journal Note`, `Creative Prompt`) with `Side A` and `Side B` definitions, URL reference links, `*/*` attachments, and Markdown editor/preview; expand notes with any local model; save to `Desktop/Journal & Skill Mode`; attach/sync directly into `WorkspaceProject.skills`. |
| **FR-07** | **Universal File Ingestion (`*/*`)** | Support drag-and-drop and picker uploads of any file across Chat, Compare, Hyper Mode, Journal & Skills, and Projects: images convert to base64 + DataURL for vision payloads; recognized code/text files read up to 48,000 chars; binary files (PDF/DOCX/ZIP/logs) extract up to 12,000 chars of printable UTF-8/ASCII runs from the first 1.5 MB. |
| **FR-08** | **Isolated Projects & Rules (`Projects`)** | Create/delete/switch independent projects with dedicated `motif`, `defaultModel`, `enabledModels`, `brainPrompt`, `rulesMarkdown` + `rulesEnabled`, `baseUrl`, `params` (`temperature`, `topP`, `numCtx`, `keepAlive`, `jsonMode`, `thinkMode`, `toolsEnabled`), `contextItems`, `envVars`, `folders`, and `conversations`. |
| **FR-09** | **Skills & HTTP/Built-in Connectors (`Skills & Connectors`)** | Toggle/add custom prompt skill modules; manage tool schemas exposed via `/api/chat` `tools[]`: 3 built-in deterministic tools (`get_current_datetime`, `evaluate_math`, `fetch_http_json`) + custom REST (`GET`/`POST`/`PUT`) connectors supporting `{{arg}}` and `{{env.KEY}}` interpolation. |
| **FR-10** | **Live Context Monitor & Pruning** | Compute real-time token utilization across 6 layers (Project Brain, `rules.md`, Resources, Skills, Tools JSON, Thread Prompt + History + Vision tile estimates + Draft); flag `Healthy` (`<70%`), `Elevated` (`70–89%`), `Critical` (`>=90%`); let users toggle resources/skills or prune older history. |
| **FR-11** | **Workspace Sync, Backup & Chat Import** | Export/smart-merge `WorkspaceSyncBundle` (`schemaVersion: 1`) preserving newer timestamps and deduplicating projects/chats/models; support File System Access API local `.json` auto-mirroring; import ChatGPT `conversations.json` (`mapping` trees), generic JSON arrays, or Markdown/text transcripts; drag-and-drop conversation folders + Quick Prompts (`query` vs `system`). |
| **FR-12** | **Packaging, Theme & Interactive Guide** | Dual Light/Dark Burgundy & Cream themes (`gemma_studio_theme_v1` synced with `guide.html`); offline PWA (`vite-plugin-pwa`); automated `nimchesko-ai-studio-app.zip` launcher; Electron desktop app with native IPC Markdown saving; GitHub Actions builds for Windows, macOS, and Linux + GitHub Pages deployment serving `guide.html` at root. |

---

## 7. Non-Functional Requirements

| Category | Requirement | Implementation Guarantee |
| --- | --- | --- |
| **Privacy & Data Residency** | Zero telemetry or unsolicited outbound requests. | All data lives in browser `localStorage`, user-selected local files, `~/Desktop/...`, and user-configured Ollama/webhook endpoints. |
| **Large-File Memory Safety** | Hashing multi-GB `.gguf` weights must not OOM the browser/Electron renderer. | `computeFileSha256` hashes files sequentially in **4 MB (`4 * 1024 * 1024`) slices** via custom `IncrementalSha256`. |
| **Local Storage Resilience** | Heavy image attachments must not break state persistence on 5 MB `localStorage` quota limits. | Automatic quota catch block strips base64 `dataUrl`/`base64` payloads while preserving text conversations, falling back cleanly. |
| **Desktop & Tool Security** | Prevent XSS/RCE in Electron renderer and unsafe eval in built-in math tool. | Electron enforces `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; `window.open` denied for external URLs (delegated to `shell.openExternal`); path segments sanitized against traversal; `safeEvaluateMath` whitelists strict math tokens and numeric digits only; HTTP tools restrict protocols to `http:` / `https:`. |
| **Localhost Guard on Web Save** | Remote visitors must not trigger writes to a server filesystem. | `/api/desktop-files/save` middleware in `vite.config.ts` strictly checks `Host` is `localhost` or `127.0.0.1` (returns `403 remote_host` otherwise). |
| **Performance & Responsiveness** | Smooth streaming UI on desktop and mobile viewports. | Zero-latency NDJSON `ReadableStream` decoder, abortable requests (`AbortController`), VRAM-safe sequential mode, Tailwind responsive drawers. |
| **Internationalization (Docs)** | Full accessibility for global users in `guide.html` and `README*.md`. | Complete parity across `en`, `fa` (RTL), `ar` (RTL), `de`, `es`, `fr`, `tr` with automatic browser language detection and persistent selector. |

---

## 8. Key Keyboard Shortcuts & Ergonomics

| Shortcut | Scope | Action |
| --- | --- | --- |
| `Cmd / Ctrl + Enter` | Chat Composer | Send message immediately (with mandatory chat naming check if title is default). |
| `Cmd / Ctrl + N` | Global App | Open modal / create new named conversation inside active project. |
| `Cmd / Ctrl + K` | Global App | Clear active conversation history (after confirmation). |

---

## 9. Acceptance Criteria & Verification Gates

Every release build must pass:
1. `tsc --noEmit` (`npm run lint`) with zero TypeScript errors.
2. `vite build` (`npm run build` and `VITE_BASE=/nimchesko-aistudio/ npm run build`) producing `dist/`, `dist/sw.js`, `dist/guide.html`, and `dist/nimchesko-ai-studio-app.zip`.
3. `node --check desktop/main.cjs desktop/preload.cjs` and `bash -n desktop/scripts/*.sh` syntax verification.
4. `public/guide.html` DOM ID & 7-language key parity validation (zero missing IDs or translation keys).
5. GitHub Actions matrix completion producing artifacts for **Linux** (`.deb`, `.rpm`, `.AppImage`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.zip`), **Windows** (`.exe` NSIS setup + portable), **macOS** (`.pkg` universal), and **GitHub Pages** (`index.html` serving `guide.html`, `studio.html` serving the web studio).
