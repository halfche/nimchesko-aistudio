[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Mehrsprachiger HTML-Leitfaden (im App-Design):** **[Hier klicken für `public/guide.html`](public/guide.html)**

Plattformübergreifender lokaler KI-Arbeitsbereich für **Ollama** (`gemma4:12b`, lokale Tags, `Modelfile` und `.gguf`) im minimalistischen **Burgunderrot- & Creme-Design** mit persischen Architekturmotiven.

## Hauptfunktionen

- **Isolierte Projekte:** Eigene Regeln (`rules.md`), Ressourcen, System-Konnektoren, Modellparameter und Chatverläufe pro Projekt.
- **Modelle & Synchronisierung (`Models & Sync`):** Ollama-Modelle laden (`/api/pull`), prüfen (`/api/show`), `Modelfile`/`.gguf` importieren, `.json`-Sync-Pakete exportieren/zusammenführen und Chat-Exporte (`.json`, `.md`, `.txt`) einlesen.
- **Produktivität:** Drag-and-Drop-Ordner, Quick-Prompts-Bibliothek, Live-Kontextmonitor, automatisches Speichern sowie Tastenkürzel (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
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
npm install
npm run build
```

Aktivieren Sie unter **Settings → Actions → General → Workflow permissions** die Option **Read and write permissions**, damit `.github/workflows/release-desktop.yml` alle Pakete automatisch als GitHub Release bereitstellt.
