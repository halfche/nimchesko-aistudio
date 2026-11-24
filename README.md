[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Interactive Multilingual HTML Guide (Rendered Interface, Burgundy & Cream Theme):**
> - GitHub renders `.html` repository files (`public/guide.html`) as source code. To open the **rendered interactive guide & live app UI** directly from GitHub:
>   1. Enable **Settings → Pages → Source: GitHub Actions** once (`.github/workflows/deploy-pages.yml` deploys it automatically).
>   2. Open your live interface at **`https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/guide.html`** (or **`https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/`** for the full studio).
> - Or view/download the standalone file here: **[`public/guide.html`](public/guide.html)** *(open locally in any browser — supports English, فارسی, العربية, Deutsch, Español, Français, Türkçe + Light/Dark mode)*.

Cross-platform local AI studio and integration workbench for Ollama (`gemma4:12b`, pulled Ollama tags, custom `Modelfile`s, and `.gguf` definitions), built with a minimal **Burgundy & Cream** aesthetic and Iranian architectural motifs.

## Key Features

- **Isolated Project Workspaces:** Separate brains, `rules.md`, markdown/text resource files, system connectors, model parameters, and conversation histories per project.
- **Local Models & Sync (`Models & Sync`):** Pull models from Ollama (`/api/pull`), inspect (`/api/show`), import `Modelfile` / `.gguf` definitions, export/smart-merge `.json` workspace sync bundles, link a local `.json` file on disk for automatic mirroring, and import `.json` / ChatGPT `conversations.json` / `.md` / `.txt` transcripts.
- **Workspace Productivity:** Drag-and-drop sidebar folders, Quick Prompts library, live Context Monitor & pruning modal, debounced auto-save with composer drafts, and global shortcuts (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
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
npm install
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
