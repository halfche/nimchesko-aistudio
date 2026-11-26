[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Interactive Multilingual HTML Guide (Opens Directly in Browser — No Raw Code or 404):**
> - **[Open Full Interactive Guide (`guide.html` on GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/)** *(also at [guide.html](https://halfche.github.io/nimchesko-aistudio/guide.html) — includes a button back to this Main Repo & Web Studio)*
> - **[Open Instant HTML Guide (CDN Mirror)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html)** · **[Launch Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Desktop Releases](https://github.com/halfche/nimchesko-aistudio/releases)**
> - Available in English, فارسی, العربية, Deutsch, Español, Français, and Türkçe with synced Light/Dark themes.

## What Is nimchesko AI studio?

**nimchesko AI studio** is a 100% local, model-agnostic AI studio, multi-model comparison workbench, and creative pipeline workspace for **all local models** (imported from **local files** such as `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` or pulled/discovered via **Ollama**). Built with React, TypeScript, Vite, and Electron in a **Burgundy & Cream** aesthetic with Iranian architectural motifs, it runs offline with zero Docker or cloud requirement.

## Complete Feature Set

- **Any Local Model Import (`Models & Sync`):** Auto-discover `/api/tags`, stream local `.gguf` / `.bin` / `.safetensors` weights straight into Ollama via `/api/blobs` + `/api/create`, import `Modelfile`s or `.json` profiles, pull Ollama tags or `hf.co/...` models, and inspect `/api/show` specs.
- **Multi-Model Chat & Mandatory Naming (`Chat`):** Query one or several local models inside a single conversation, require descriptive chat names (with auto-suggestion), inspect live `tok/s` & token telemetry, and organize threads in drag-and-drop folders.
- **Side-by-Side Model Comparison (`Compare`):** Run prompts across 2+ or all local models Sequentially (VRAM-safe) or in Parallel, compare `tok/s` speed, latency, token counts, and reasoning traces, export Markdown reports, and continue any winner in Chat.
- **Hyper Mode — Dual-Model Pipeline (`Hyper Mode`):** Pair a Higher Architect model with a fast Lower Builder model, require a session name, choose your Markdown output language (English, فارسی, العربية, Code, etc.), and auto-save formatted specs to `Desktop/Hyper Mode Markdown Files`.
- **Journal & Skill Mode (`Journal & Skills`):** Author named skills/notes with `Side A -> Side B` workflow bridges, reference links, and universal file uploads; let a local model expand them into Markdown skills; save to `Desktop/Journal & Skill Mode`; and attach directly to your active Project.
- **Universal File Uploads (`*/*`):** Attach code, Markdown, PDF, Office (`.docx`, `.xlsx`, `.csv`), JSON, archives (`.zip`), images, audio, and video across Chat, Compare, Hyper Mode, Journal & Skills, and Projects (plus drag-and-drop folders).
- **Isolated Project Workspaces (`Projects`):** Separate system brains, `rules.md`, resource files, environment variables, model parameters (`temperature`, `num_ctx`, `top_p`, `seed`), and tool/System Connectors per project.
- **Sync, Backup & Themes:** Export/smart-merge `.json` bundles, link a local `.json` mirror on disk, import ChatGPT `conversations.json`, monitor context usage live, use global shortcuts (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`), and switch between Light/Dark Burgundy & Cream themes.

## Comparison With Similar Tools

| Capability | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| 100% Free & Open Source | **Yes (MIT)** | Yes (MIT) | Custom License | Closed Source | Yes (MIT) | Mixed |
| Zero Docker / Zero Backend Setup | **Yes (Static / Electron / `.zip`)** | CLI Only | No (Docker / Python) | Desktop App | Heavier Stack | Desktop App |
| Direct `.gguf` / `.safetensors` + Ollama Auto-Discover | **Yes (`/api/tags` + `/api/blobs`)** | CLI `create` | Ollama Only | Built-in GGUF | Via Provider | Built-in |
| Side-by-Side All-Model Compare (VRAM-safe Sequential) | **Yes (`Compare` Tab)** | No | Split View Only | Single Active | No | Limited (Msty) |
| Multi-Model Responses Inside One Chat | **Yes (Multi-Select)** | No | Partial | Single Model | Single Model | Single Model |
| Dual-Model `Hyper Mode` -> Desktop `.md` Specs | **Yes (Auto-Saved)** | No | No | No | No | No |
| `Journal & Skills` (`Side A -> Side B`) -> Project Sync | **Yes (Auto-Saved)** | No | Prompts Only | No | Docs / Agents | No |
| Universal `*/*` File Uploads Everywhere | **Yes** | Manual Path | RAG Docs | Text / Images | RAG Workspaces | Limited |
| `.deb` / `.rpm` / `.AppImage` / `.pkg.tar.zst` / `.exe` / `.pkg` + PWA | **Yes (All Formats)** | CLI | Web / Docker | Subset | Subset | Subset |

## Quick Start (Zero-Setup `.zip` Package)

1. Download **`nimchesko-ai-studio-app.zip`** from the app header (**Download App (.zip)**), the [Interactive Guide](https://halfche.github.io/nimchesko-aistudio/), or GitHub **Releases**.
2. Extract the archive and run:
   - **Windows:** Double-click `run-windows.bat` (automatically uses Python, Node.js, or PowerShell).
   - **Linux:** Run `chmod +x run-linux.sh && ./run-linux.sh`.
3. Enable local Ollama browser access before starting Ollama:
   ```bash
   # Linux / macOS
   OLLAMA_ORIGINS=* ollama serve

   # Windows PowerShell
   $env:OLLAMA_ORIGINS="*"; ollama serve
   ```

## Local Development & Build from Source

```bash
npm install --legacy-peer-deps
npm run dev      # Development server on http://localhost:3000
npm run build    # Compiles dist/ and dist/nimchesko-ai-studio-app.zip
```

## GitHub Actions CI/CD Desktop Releases

Workflow file: `.github/workflows/release-desktop.yml` (Pages deployment: `.github/workflows/deploy-pages.yml`).

Before running on a fork or new repository, enable **Settings → Actions → General → Workflow permissions → Read and write permissions**, and set **Settings → Pages → Source → GitHub Actions**.

| Platform / Distro | Format(s) | Install / Run |
| --- | --- | --- |
| Debian / Ubuntu | `.deb` | `sudo apt install ./nimchesko-ai-studio-*.deb` |
| Fedora / RHEL / openSUSE | `.rpm` | `sudo dnf install ./nimchesko-ai-studio-*.rpm` |
| Arch Linux | `.pkg.tar.zst` | `sudo pacman -U ./nimchesko-ai-studio-*.pkg.tar.zst` |
| Linux Universal | `.AppImage`, `.tar`, `.tar.zst` | `chmod +x *.AppImage && ./*.AppImage` |
| Windows | `.exe` (Setup & Portable) | Run installer or portable executable |
| macOS | `.pkg` | Open `.pkg` installer |
| Web / PWA Bundle | `.zip` | Extract and run `run-windows.bat` or `run-linux.sh` |
