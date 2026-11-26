# Complete Architecture & Project Reference — `nimchesko AI studio`

This document describes the entire `nimchesko AI studio` codebase from the smallest primitive (constants, TypeScript interfaces, `localStorage` keys, and SVG motifs) up to macro architecture, cross-layer data flows, Desktop IPC, Electron runtime, and GitHub Actions CI/CD packaging.

---

## 1. Macro Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                               USER RUNTIMES                                       |
|  1. Browser / PWA (Vite SPA + Workbox SW)    3. Portable .zip (win .bat / .sh)    |
|  2. GitHub Pages (guide.html @ /, studio.html) 4. Electron App (Win/Mac/Linux)    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        PRESENTATION LAYER (React 19 + Tailwind CSS v4)            |
|  App.tsx (State Coordinator, Sidebar, Header, Modals, Global Shortcuts)           |
|   ├── ChatView.tsx           (Single/Multi-Model Thread, Mandatory Naming, Files) |
|   ├── CompareView.tsx        (Sequential/Parallel Benchmark Arena, /api/show)     |
|   ├── HyperModeView.tsx      (Dual-Model Higher->Lower Blueprints -> Desktop .md) |
|   ├── JournalCreativeView.tsx(Side A->Side B Skills, Links, Files -> Desktop .md) |
|   ├── ProjectsView.tsx       (Brain, rules.md, Resources, Env Vars, Motifs)       |
|   ├── ModelsAndSyncView.tsx  (Ollama Tags/Pull, Blob Upload, Modelfile, Sync)     |
|   ├── SkillsAndConnectorsView.tsx (Prompt Skills & Tool Calling Connectors)       |
|   ├── ContextMonitorModal.tsx(6-Layer Token Budget & Pruner)                      |
|   └── IntegrationGuide.tsx / PersianMotifs.tsx / MarkdownRenderer.tsx             |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         SERVICES & DOMAIN LOGIC (src/services/)                   |
|  ollamaClient.ts   │ composeSystemPrompt, NDJSON stream, tool schemas, SHA-256    |
|  fileUploads.ts    │ */* ingestion (Vision base64, 48k text, 1.5MB binary scan)   |
|  desktopFiles.ts   │ 4-tier Desktop .md writer (IPC -> HTTP -> Picker -> Download)|
|  contextMetrics.ts │ Token estimation (len/4 + 256/img), status thresholds        |
|  workspaceSync.ts  │ Timestamp smart-merge, ChatGPT mapping & MD transcript parser|
+-------------------+---------------------+-------------------------+---------------+
                    |                     |                         |
                    v                     v                         v
+-------------------------+ +-------------------------+ +---------------------------+
| LOCAL STORAGE ENGINE    | | OLLAMA DAEMON (HTTP)    | | DESKTOP FILESYSTEM        |
| 14 Persistent Keys      | | /api/tags, /api/chat    | | ~/Desktop/                |
| Auto Quota Stripping    | | /api/pull, /api/show    | |  ├── Hyper Mode Markdown  |
| Legacy v1 Auto-Migrate  | | /api/blobs, /api/create | |  │   Files/*.md           |
+-------------------------+ | /api/delete             | |  └── Journal & Skill      |
                            +-------------------------+ |      Mode/*.md            |
                                                        +---------------------------+
```

---

## 2. Project Delivery Phases & Technical Structure

1. **Phase 1 — Streaming Core:** Established Vite + React 19 + TypeScript base, NDJSON `ReadableStream` parser in `ollamaClient.ts`, `<thought>` tag extraction, multimodal image handling, and CORS/PNA error classification.
2. **Phase 2 — Project Isolation & Productivity:** Introduced `WorkspaceProject` entities, `rules.md`, resource libraries, deterministic tool calls (`evaluate_math`, `get_current_datetime`, `fetch_http_json`) plus custom REST webhooks with `{{env.KEY}}`, conversation folders, quick prompts, and `ContextMonitorModal`.
3. **Phase 3 — Model-Agnostic Generalization & Comparison:** Removed Gemma 4 lock-in, introduced `CompareView` (sequential VRAM-safe and parallel benchmarking), implemented incremental SHA-256 `/api/blobs` + `/api/create` direct weight uploads for `.gguf`/`.bin`/`.safetensors`, added `Modelfile` parsing, and shipped `workspaceSync.ts`.
4. **Phase 4 — Dual-Model Pipelines, Skill Bridging & Universal Files:** Built `HyperModeView`, `JournalCreativeView`, `desktopFiles.ts` + Electron IPC / Vite localhost bridges, multi-model per-chat fan-out, mandatory chat naming, and universal `*/*` file ingestion (`fileUploads.ts`).
5. **Phase 5 — Cross-Platform Distribution & Standalone Guide:** Added Electron packaging (`desktop/`), combined `.zip` launcher scripts (`run-windows.bat`, `run-linux.sh`), 7-language interactive `public/guide.html`, GitHub Pages workflow (`deploy-pages.yml`), and multi-OS CI/CD (`release-desktop.yml`) including `desktop/scripts/build-linux.sh` with isolated per-target staging directories and direct native `rpmbuild` for Ubuntu 24.04.

---

## 3. Complete File-by-File Repository Inventory

### Root Configuration & Documentation
| Path | Purpose |
| --- | --- |
| `package.json` | Web scripts (`dev`, `build`, `preview`, `clean`, `lint`), React 19, Tailwind v4, Vite 8, `vite-plugin-pwa`, `jszip`, `lucide-react`, `react-markdown`, `remark-gfm`, `typescript` (`7.0.2`). |
| `vite.config.ts` | Configures `VITE_BASE`, React/Tailwind plugins, PWA Workbox caching, asset copying, `package-combined-app-zip` build hook, localhost-guarded `/api/desktop-files/save` middleware, and HMR WebSocket guard. |
| `index.html` | SPA HTML shell with Google Fonts (`DM Sans`, `Plus Jakarta Sans`, `JetBrains Mono`), Burgundy (`#6B1D2F`) theme meta, PWA icons, and `#root` mount. |
| `metadata.json` | Host applet metadata (locked name: `Gemma Studio for Ollama`). |
| `tsconfig.json` | Strict TypeScript compiler configuration checked by `npm run lint` (`tsc --noEmit`). |
| `README.md` + `README.{fa,ar,de,es,fr,tr}.md` | Seven-language repository documentation with interactive GitHub Pages guide links, complete feature summary, tool comparison matrix, and release formats. |
| `documents/` | Complete product (`PRD.md`) and engineering (`ARCHITECTURE_AND_PROJECT_REFERENCE.md`) documentation folder. |

### `src/` Application Source (~16,160 lines)
| File | Lines | Responsibility |
| --- | --- | --- |
| `src/main.tsx` | — | React 19 `createRoot` entry point mounting `<App />` and importing `src/index.css`. |
| `src/index.css` | 173 | Tailwind v4 import, `.dark` custom variant, Burgundy & Cream ambient `.cream-burgundy-canvas` gradients, and `.markdown-prose` styling. |
| `src/types/ollama.ts` | 308 | All core TypeScript interfaces & union types across the entire application. |
| `src/data/presets.ts` | 354 | `DEFAULT_MODEL_PARAMS`, 4 built-in `DEFAULT_SKILLS`, 5 `DEFAULT_CONNECTORS`, factories (`createConversation`, `createWorkspaceProject`, `createInitialProjects`). |
| `src/hooks/usePWAInstall.ts` | 86 | `usePWAInstall()` (`beforeinstallprompt`, iOS detection, standalone check) and `useOnlineStatus()`. |
| `src/App.tsx` | 2,258 | Global state orchestrator, persistence engine, tab router (`chat`, `compare`, `hyper`, `journal`, `projects`, `models`, `skills`, `guide`), multi-model chat executor, tool-call loop, mandatory chat naming modal, and global shortcuts (`Cmd/Ctrl+N`, `Cmd/Ctrl+K`). |
| `src/services/ollamaClient.ts` | 1,097 | `composeSystemPrompt`, `buildOllamaToolsSchema`, `executeSystemConnector`, `safeEvaluateMath`, `probeOllamaConnection`, `streamOllamaChat`, `parseModelfileText`, `IncrementalSha256`, `computeFileSha256`, `uploadOllamaBlob`, `pullOllamaModel`, `createOllamaModel`, `showOllamaModel`, `deleteOllamaModel`. |
| `src/services/fileUploads.ts` | 170 | `readAnyUploadedFiles` (image/text/binary classification), `formatMessageWithFiles`, `collectVisionBase64`. |
| `src/services/desktopFiles.ts` | 226 | `HYPER_FOLDER_NAME` (`Hyper Mode Markdown Files`), `JOURNAL_FOLDER_NAME` (`Journal & Skill Mode`), `sanitizeMarkdownFilename`, `saveMarkdownToDesktopFolder`, `openDesktopSubfolder`, `linkDesktopDirectory`. |
| `src/services/contextMetrics.ts` | 242 | `estimateTokens`, `formatTokenCount`, `computeContextSnapshot` (6-bucket token breakdown & status thresholds). |
| `src/services/workspaceSync.ts` | 390 | `buildWorkspaceSyncBundle`, `mergeWorkspaceSyncBundle`, `parseImportedChatFiles` (bundles, ChatGPT `mapping` trees, `.md`/`.txt` transcripts). |
| `src/components/ChatView.tsx` | 1,407 | Multi-model chat selector, message stream rendering, mandatory chat naming guard, `*/*` attachment chip strip, drag-and-drop, inline `<thought>` accordion, tool execution log pills, and `Cmd/Ctrl+Enter` send. |
| `src/components/CompareView.tsx` | 1,189 | Unified Ollama + local model selector, Sequential/Parallel runner, `/api/show` inspector modal, preset benchmark prompts, Markdown report exporter, promote winner to Chat. |
| `src/components/HyperModeView.tsx` | 1,194 | Named session list, Higher Architect + Lower Builder pickers, output language selector (`auto`, `fa`, `en`, `ar`, `fr`, `de`, `es`), two-stage streaming pipeline, and Desktop `.md` saver. |
| `src/components/JournalCreativeView.tsx` | 961 | Named entries (`Skill Module`, `Model Bridge`, `Journal Note`, `Creative Prompt`), `Side A -> Side B` inputs, reference URL chips, `*/*` attachments, AI skill synthesis, Desktop `.md` save, and one-click attach to active Project. |
| `src/components/ProjectsView.tsx` | 1,566 | Project switcher/creator/deleter, Persian motif selector, `brainPrompt`, `rules.md` editor, resource file uploader & folder drag-and-drop, and `ProjectEnvVar` editor. |
| `src/components/ModelsAndSyncView.tsx` | 1,288 | Endpoint health tester, Auto-Discover & Pull (`hf.co/...`), local `.gguf`/`.bin`/`.safetensors`/`Modelfile`/`.json` uploader (`/api/blobs` + `/api/create`), `.json` bundle export/merge, disk mirror linking, and ChatGPT history importer. |
| `src/components/SkillsAndConnectorsView.tsx` | 1,072 | Toggle/create prompt skills (`SkillModule`) and custom HTTP/webhook connectors (`SystemConnector`) with test/parameter editors. |
| `src/components/ContextMonitorModal.tsx` | 645 | Visual bar breakdown of context budget (`numCtx`), per-resource/skill toggles, quick history pruner, and effective prompt preview. |
| `src/components/ConversationFoldersSidebar.tsx` | 535 | Drag-and-drop folders, thread list, rename/delete controls, and unread/draft indicators. |
| `src/components/QuickPromptsSidebarSection.tsx` | 258 | Saved query & system persona prompt templates for one-click composer insertion. |
| `src/components/IntegrationGuide.tsx` | 502 | In-app setup troubleshooting guide (`OLLAMA_ORIGINS=*`, Chrome PNA hints, OS curl checks). |
| `src/components/PersianMotifs.tsx` | 254 | Five geometric SVG motifs (`ShamsehEmblem`, `PersepolisMotif`, `AzadiTowerMotif`, `IsfahanDomeMotif`, `SiOSePolMotif`). |
| `src/components/MarkdownRenderer.tsx` | 48 | `react-markdown` + `remark-gfm` renderer routing fenced code to `CodeSnippetBlock`. |
| `src/components/CodeSnippetBlock.tsx` | 53 | Copyable syntax block with feedback state. |
| `src/components/PWAInstallButton.tsx` | 88 | Online/Offline indicator pill and native PWA install prompt button. |

### `desktop/`, `public/`, & `.github/workflows/`
| File | Purpose |
| --- | --- |
| `desktop/package.json` | Electron 34.3.0, `electron-builder` 25.1.8, `png2icons` 2.0.1, scripts `prepare:icons`, `dist:linux`, `dist:win`, `dist:mac`. |
| `desktop/main.cjs` (244 lines) | Embedded HTTP server (`127.0.0.1:4173` w/ ephemeral fallback), `/api/desktop-files/save` & `/open` endpoints, Electron IPC (`desktop:save-markdown`, `desktop:open-folder`, `desktop:get-paths`), sandboxed `BrowserWindow`, single-instance lock, external URL handler. |
| `desktop/preload.cjs` (9 lines) | `contextBridge.exposeInMainWorld('nimcheskoDesktop', ...)` exposing Desktop file bridge safely. |
| `desktop/electron-builder.yml` | Cross-platform target config (`dir` default on Linux to prevent concurrent packing collisions; `deb`/`rpm` dependency lists; Windows NSIS/portable; macOS universal `.pkg`). |
| `desktop/scripts/build-linux.sh` | Isolated sequential Linux build (`dir` -> file verification -> `pristine-unpacked` snapshot -> `build-extra-linux-archives.sh` -> isolated `AppImage` -> isolated `deb` -> isolated native `rpmbuild`). |
| `desktop/scripts/build-extra-linux-archives.sh` (87 lines) | Generates `.tar`, `.tar.zst`, Arch `.pkg.tar.zst` (`.PKGINFO` + `opt/nimchesko-ai-studio`), and copies `.zip`. |
| `desktop/scripts/prepare-icons.mjs` (34 lines) | Converts `public/pwa-512x512.png` to `build/icon.png`, `icon.ico`, and `icon.icns`. |
| `public/guide.html` (~750+ lines) | Standalone 7-language (`en`, `fa`, `ar`, `de`, `es`, `fr`, `tr`) Light/Dark interactive HTML guide covering overview, features, 6-tool comparison matrix, install, and usage. |
| `public/run-windows.bat` & `public/run-linux.sh` | Zero-dependency offline web servers bundled inside `nimchesko-ai-studio-app.zip` (Python/Node/PowerShell fallback). |
| `.github/workflows/deploy-pages.yml` | Builds `VITE_BASE=/<repo>/`, maps `guide.html` -> `index.html` & `404.html`, `index.html` -> `studio.html`, deploys GitHub Pages. |
| `.github/workflows/release-desktop.yml` | Runs `build-linux`, `build-windows`, `build-macos` in parallel and combines outputs into GitHub Releases. |

---

## 4. Data Contracts & Persistent Storage (Smallest Unit Reference)

### `localStorage` Keys (`src/App.tsx` & `public/guide.html`)
| Key | Type / Role |
| --- | --- |
| `gemma_studio_projects_v2` | JSON array of `WorkspaceProject[]` (conversations, folders, brain, rules, skills, connectors, resources, env vars). |
| `gemma_studio_active_project_v2` | String ID of currently selected `WorkspaceProject`. |
| `gemma_studio_theme_v1` | `'light'` or `'dark'` (shared with `public/guide.html`). |
| `gemma_studio_context_monitor_v1` | `'true'` / `'false'` open state of Context Monitor drawer/modal. |
| `gemma_studio_autosave_v1` | Auto-save enable toggle (`'true'` / `'false'`). |
| `gemma_studio_drafts_v1` | `Record<string, string>` per-conversation unsent composer drafts. |
| `gemma_studio_imported_models_v1` | JSON array of `ImportedModelProfile[]` (local `.gguf` / `Modelfile` / custom tags). |
| `local_studio_compare_rounds_v1` | JSON array of `CompareRound[]` benchmark history. |
| `local_studio_hyper_sessions_v1` | JSON array of `HyperSession[]` (inflight `architecting`/`executing` reset to `'idle'` on load). |
| `local_studio_journal_skills_v1` | JSON array of `JournalSkillEntry[]` authored notes & skill bridges. |
| `local_studio_cleared_gemma_default_v1` | One-time migration marker clearing legacy `'gemma4:12b'` defaults. |
| `nimchesko_guide_lang` | Active language (`en`/`fa`/`ar`/`de`/`es`/`fr`/`tr`) in `public/guide.html`. |
| *Legacy v1 keys (read-only migration)* | `gemma_studio_conversations_v1`, `gemma_studio_ollama_url_v1`, `gemma_studio_params_v1`, `gemma_studio_skills_v1`, `gemma_studio_connectors_v1`. |

> **Quota Overflow Safeguard (`App.tsx` lines 409–431):** If `localStorage.setItem` throws due to base64 image sizes, the writer strips heavy `dataUrl`/`base64` fields cleanly from saved messages so conversation text is never lost.

### Key Entity Schemas (`src/types/ollama.ts`)
- **`WorkspaceProject`:** `id`, `name`, `description`, `motif` (`MotifId`), `defaultModel`, `enabledModels[]`, `brainPrompt`, `rulesMarkdown`, `rulesEnabled`, `baseUrl`, `params`, `skills[]`, `connectors[]`, `contextItems[]`, `prompts[]`, `envVars[]`, `folders[]`, `conversations[]`, `activeConversationId`, `updatedAt`.
- **`Conversation`:** `id`, `title`, `model`, `secondaryModels?: string[]`, `systemPrompt`, `folderId?`, `messages: ChatMessage[]`, `updatedAt`.
- **`ChatMessage`:** `id`, `role` (`user`|`assistant`|`system`|`tool`), `content`, `thinking?`, `modelName?`, `images?: ChatAttachment[]`, `files?: UploadedFileAttachment[]`, `toolCalls?`, `toolName?`, `toolDurationMs?`, `toolSuccess?`, `metrics?: OllamaChatMetrics`, `error?`.
- **`HyperSession`:** `id`, `name`, `higherModel`, `lowerModel`, `language`, `taskPrompt`, `attachments?`, `markdownSpec`, `lowerOutput`, `higherThinking?`, `lowerThinking?`, `savedFilePath?`, `savedMethod?`, `status`.
- **`JournalSkillEntry`:** `id`, `name`, `category`, `model`, `sourceSide`, `targetSide`, `links[]`, `prompt`, `markdownContent`, `attachments?`, `targetModels?`, `attachedProjectIds?`, `savedFilePath?`.

---

## 5. Deep-Dive: Core Service Pipelines

### 5.1 Five-Layer System Prompt Assembly (`composeSystemPrompt`)
Sent on every chat and Hyper Builder request in strict deterministic order:
1. **Project Brain:** `Project Brain (<name>):\n<brainPrompt>`
2. **Project Rules (`rules.md`):** Included when `rulesEnabled !== false`.
3. **Active Project Resources:** Each enabled `ProjectContextItem` rendered as `### Resource: <title/filename>`.
4. **Active Project Skills:** Each enabled `SkillModule` (including attached Journal skills) rendered as `### Skill: <name>`.
5. **Thread Instructions:** Optional per-conversation system prompt override.

### 5.2 Incremental SHA-256 & Local Weight Upload (`ollamaClient.ts`)
To import `.gguf`, `.bin`, or `.safetensors` files directly in browser or Electron without blowing RAM:
1. `computeFileSha256(file)` reads `file.slice(offset, offset + 4MB)` sequentially through `IncrementalSha256` (pure-JS FIPS 180-4) -> returns `sha256:<hex>`.
2. `HEAD <baseUrl>/api/blobs/<digest>` checks if Ollama already caches the weight blob (`200 OK` skips upload).
3. `POST <baseUrl>/api/blobs/<digest>` streams the raw `File` directly to Ollama.
4. `POST <baseUrl>/api/create` registers the model tag with `files: { [file.name]: digest }` plus optional `system`, `template`, and `PARAMETER` entries parsed via `parseModelfileText()`.

### 5.3 Universal `*/*` File Processing (`fileUploads.ts`)
- **Images (`image/*` except SVG):** Converted via `FileReader.readAsDataURL()` -> `dataUrl` preview + stripped `base64` injected into Ollama `message.images[]`.
- **Recognized Text/Code (`TEXT_EXTENSIONS` + `text/*`, `Modelfile`, `Dockerfile`, `Makefile`):** Read via `file.text()`, truncated safely at `48,000` characters (`truncated: true` flagged).
- **Binary / PDF / Office / Archives:** First `1,500,000` bytes decoded with `TextDecoder('utf-8', { fatal: false })` scanning printable ASCII + Arabic/Persian (`\u0600-\u06FF`) strings of length `>= 6`, capped at `12,000` characters so models inspect readable text/metadata from arbitrary files cleanly.

### 5.4 Four-Tier Desktop Markdown Persistence (`desktopFiles.ts`)
Used automatically by **Hyper Mode** (`Desktop/Hyper Mode Markdown Files/<session>.md`) and **Journal & Skills** (`Desktop/Journal & Skill Mode/<skill>.md`):
1. **Tier 1 (Electron Native IPC):** `window.nimcheskoDesktop.saveDesktopMarkdown(...)` -> `ipcMain('desktop:save-markdown')` -> `fs.writeFileSync` inside OS Desktop path.
2. **Tier 2 (Local Vite / Electron HTTP Bridge):** When running on `localhost` / `127.0.0.1`, `POST /api/desktop-files/save` writes straight to `os.homedir()/Desktop/<folder>`.
3. **Tier 3 (Browser Directory Handle):** `window.showDirectoryPicker({ id: 'nimchesko-desktop-folder', mode: 'readwrite', startIn: 'desktop' })` creates subfolder & file handle via File System Access API.
4. **Tier 4 (Universal Fallback):** Triggers sanitized Blob `.md` download in browser.

---

## 6. Design System & Visual Language

| Token | Light Mode Value | Dark Mode Value | Role |
| --- | --- | --- | --- |
| Primary Background | `#F6EFE4` | `#14070B` | Warm Cream parchment / Deep Espresso wine |
| Surface Glass | `rgba(252, 248, 242, 0.9)` | `rgba(30, 10, 17, 0.9)` | Card & topbar translucent panels |
| Primary Accent | `#6B1D2F` (`#541524` hover) | `#8C253E` (`#A02D49` hover) | Burgundy CTAs, borders, active indicators |
| Text Primary | `#2B0F17` | `#F5ECE0` | High-contrast body copy |
| Text Secondary / Accent Ink | `#6E4A53` | `#CEB8AE` / `#E6B8A2` | Muted labels & champagne highlights |
| Typography | `Plus Jakarta Sans` (Display) | `DM Sans` (Body) | `JetBrains Mono` (Code, metrics, tabular nums) |

---

## 7. Security, Build & CI/CD Hardening Details

- **Electron Security Boundaries (`desktop/main.cjs`):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, static server binds strictly to `127.0.0.1:4173` (falling back to ephemeral `0` on port collision), `path.posix.normalize` prevents path traversal out of `desktop/dist`, and `setWindowOpenHandler` blocks in-app popups while forwarding verified `http://` / `https://` links to OS browser.
- **Built-In Tool Safety (`ollamaClient.ts`):** `safeEvaluateMath` limits expression length (`<= 160` chars), strips only known safe `Math.*` identifiers, and verifies purely numeric operators before evaluation; URL tools reject non-`http(s):` schemes.
- **Isolated Sequential Linux Release Packaging (`desktop/scripts/build-linux.sh`):**
  - `desktop/electron-builder.yml` restricts `linux.target` to `dir` only so AppImage, `.deb`, and `.rpm` never package concurrently or collide over `release/linux-unpacked` (`cannot copy using hard link: resources/app-update.yml`).
  - Cleans `release/`, `release-stage/`, and `desktop/dist/`, unpacks `dir` once, verifies `nimchesko-ai-studio`, `resources/app.asar`, `LICENSE.electron.txt`, `LICENSES.chromium.html`, `chrome-sandbox`, and `locales/`, snapshots `pristine-unpacked`, builds `.tar`/`.tar.zst`/`.pkg.tar.zst`, and then runs `AppImage` and `.deb` in separate input and `-c.directories.output` staging directories before copying artifacts to `release/`.
  - Builds `.rpm` directly with native `rpmbuild -bb` from `%{_sourcedir}/app-root` in an isolated `release-stage/rpm` `%_topdir` (`%global debug_package %{nil}`, `%global __os_install_post %{nil}`, `AutoReqProv: no`, concrete Fedora/RHEL dependencies, `4755` `chrome-sandbox`), eliminating `electron-builder`/FPM 1.9.3 `BUILDROOT` file-not-found failures on Ubuntu 24.04 (`RPM 4.18+`).
  - Produces 7 Linux artifacts (`*.deb`, `*.rpm`, `*.AppImage`, `*.tar`, `*.tar.zst`, `*-x86_64.pkg.tar.zst`, `nimchesko-ai-studio-app.zip`) plus Windows (`.exe` NSIS + portable) and macOS (`.pkg`).
- **GitHub Pages Routing (`.github/workflows/deploy-pages.yml`):** Serves `guide.html` directly at `/` (`index.html`) and `/404.html` so visitors immediately see an interactive HTML guide without raw code or 404s, while exposing the full SPA studio at `/studio.html` and offline archive at `/nimchesko-ai-studio-app.zip`.
