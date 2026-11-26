[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Interactive Multilingual HTML Guide (Opens Directly in Browser — No Raw Code):**
> - **[Open Full Interactive Guide (`guide.html` on GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/)** *(also at [guide.html](https://halfche.github.io/nimchesko-aistudio/guide.html) — includes a button back to this Main Repo & Web Studio)*
> - **[Open Instant HTML Guide (CDN Mirror)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html)** · **[Launch Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Desktop Releases](https://github.com/halfche/nimchesko-aistudio/releases)**
> - Supports English, فارسی, العربية, Deutsch, Español, Français, Türkçe + Light/Dark mode.

Cross-platform local AI studio, multi-model comparison workbench, and integration workspace for **all local models** (imported from **local files** like `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` or pulled/discovered via **Ollama**), built with a minimal **Burgundy & Cream** aesthetic and Iranian architectural motifs.

## Key Features

- **Compare All Local Models (`Compare`):** Run prompts side-by-side across all selected or installed local models (Sequential VRAM-safe or Parallel), inspect `/api/show` specs, compare `tok/s` speed, latency, token counts, and reasoning traces, export Markdown reports, and continue any winner in Chat.
- **Any Local Model Import (`Models & Sync`):** Add any local model from **local files** (stream `.gguf` / `.bin` / `.safetensors` weights straight into Ollama via `/api/blobs` + `/api/create`, import `Modelfile`s or `.json` profiles) or from **Ollama** (auto-discover `/api/tags`, one-click Import All, pull any tag or HuggingFace `hf.co/...` model).
- **Isolated Project Workspaces:** Separate brains, `rules.md`, markdown/text resource files, system connectors, model parameters, and conversation histories per project.
- **Workspace Sync & Productivity:** Export/smart-merge `.json` workspace sync bundles, link a local `.json` file on disk for automatic mirroring, import `.json` / ChatGPT `conversations.json` / `.md` / `.txt` transcripts, drag-and-drop folders, Quick Prompts, live Context Monitor, auto-save, and global shortcuts (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Light & Dark Themes:** Dual Burgundy & Cream Light/Dark palettes plus a standalone themed HTML guide (`public/guide.html`).
- **Cross-Platform Packaging:** One-click combined web bundle (`nimchesko-ai-studio-app.zip`) and automated GitHub Actions CI/CD desktop installers (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Quick Start (Pre-Built Combined Package)

1. Download **`nimchesko-ai-studio-app.zip`** from the app header (**Download App (.zip)**) or from GitHub **Releases**.
2. Extract the archive:
   - **Windows:** Double-click `run-windows.bat` (uses Python, Node.js, or built-in PowerShell automatically).
   - **Linux:** Run `chmod +x run-linux.sh && ./run-linux.sh`.
3. Enable local Ollama browser access before starting Ollama:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## Local Development & Build from Source

```bash
npm install --legacy-peer-deps
npm run dev      # Development server on http://localhost:3000
npm run build    # Compiles dist/ and dist/nimchesko-ai-studio-app.zip
```

## GitHub Actions CI/CD Desktop Releases

Workflow file: `.github/workflows/release-desktop.yml`

Before running on a new repository, enable **Settings → Actions → General → Workflow permissions → Read and write permissions**.

Every push to `main` / `master`, version tag (`v*`), or manual **Run workflow** dispatch builds:

| Platform / Distro | Format(s) | Install / Run |
| --- | --- | --- |
| Debian / Ubuntu | `.deb` | `sudo apt install ./nimchesko-ai-studio-*.deb` |
| Fedora / RHEL / openSUSE | `.rpm` | `sudo dnf install ./nimchesko-ai-studio-*.rpm` |
| Arch Linux | `.pkg.tar.zst` | `sudo pacman -U ./nimchesko-ai-studio-*.pkg.tar.zst` |
| Linux Universal | `.AppImage`, `.tar`, `.tar.zst` | `chmod +x *.AppImage && ./*.AppImage` |
| Windows | `.exe` (Setup & Portable) | Run installer or portable executable |
| macOS | `.pkg` | Open `.pkg` installer |
| Web / PWA Bundle | `.zip` | Extract and run `run-windows.bat` or `run-linux.sh` |
