[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Mehrsprachiger HTML-Leitfaden (Direkt im Browser öffnen):** **[Vollständigen Leitfaden öffnen (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#de)** · **[Sofort-Mirror (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#de)** · **[Web-Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Plattformübergreifender lokaler KI-Arbeitsbereich zum Ausführen, Importieren und Vergleichen **aller lokalen Modelle** (über **lokale Dateien** wie `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` oder via **Ollama**) im minimalistischen **Burgunderrot- & Creme-Design** mit persischen Architekturmotiven.

## Hauptfunktionen

- **Alle lokalen Modelle vergleichen (`Compare`):** Prompts sequenziell oder parallel über beliebig viele lokale Modelle testen, `/api/show`-Details prüfen, `tok/s` und Latenzen vergleichen und als Markdown exportieren.
- **Beliebige lokale Modelle importieren (`Models & Sync`):** Lokale Gewichtsdateien direkt per `/api/blobs` + `/api/create` in Ollama laden oder Ollama-Tags & `hf.co/...`-Modelle verwalten (`/api/pull`, `/api/show`), inklusive `.json`-Sync und Chat-Import (`.json`, `.md`, `.txt`).
- **Isolierte Projekte & Produktivität:** Eigene Regeln (`rules.md`), Ressourcen, System-Konnektoren, Drag-and-Drop-Ordner, Quick-Prompts, Live-Kontextmonitor, automatisches Speichern und Tastenkürzel (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Plattformübergreifende Pakete:** Kombiniertes Web-Archiv (`nimchesko-ai-studio-app.zip`) und automatisierte GitHub Actions CI/CD-Builds (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Schnellstart

1. **`nimchesko-ai-studio-app.zip`** herunterladen und entpacken.
2. **Windows:** `run-windows.bat` per Doppelklick starten. **Linux:** `chmod +x run-linux.sh && ./run-linux.sh`.
3. Ollama mit aktiviertem CORS starten:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## Lokale Entwicklung & GitHub Actions CI/CD

```bash
npm install --legacy-peer-deps
npm run build
```

Aktivieren Sie unter **Settings → Actions → General → Workflow permissions** die Option **Read and write permissions**, damit `.github/workflows/release-desktop.yml` alle Pakete automatisch als GitHub Release bereitstellt.
