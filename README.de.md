[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Mehrsprachiger HTML-Leitfaden (Direkt im Browser öffnen):** **[Vollständigen Leitfaden öffnen (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#de)** · **[Sofort-Mirror (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#de)** · **[Web-Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Plattformübergreifender, zu 100 % lokaler KI-Arbeitsbereich für **alle lokalen Modelle** (`.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` oder **Ollama**) im **Burgunderrot- & Creme-Design** ohne Docker- oder Cloud-Zwang.

## Hauptfunktionen

- **Beliebige lokale Modelle (`Models & Sync`):** Ollama-Tags automatisch erkennen, `.gguf`/`.bin`/`.safetensors` direkt via `/api/blobs` + `/api/create` laden oder `hf.co/...` ziehen.
- **Multi-Modell-Chat & Pflichtbenennung (`Chat`):** Mehrere Modelle parallel in einem Chat befragen, klare Chat-Namen erzwingen und in Ordnern organisieren.
- **Modellvergleich (`Compare`):** Sequenziell (VRAM-schonend) oder parallel vergleichen, `tok/s` prüfen und als Markdown exportieren.
- **Hyper Mode:** Higher-Architect + Lower-Builder-Pipeline mit automatischer `.md`-Speicherung in `Desktop/Hyper Mode Markdown Files`.
- **Journal & Skills:** `Side A -> Side B`-Workflows, Links und Dateien als Skills in `Desktop/Journal & Skill Mode` sichern und an Projekte koppeln.
- **Universelle Datei-Uploads (`*/*`) & Isolierte Projekte:** Code, PDF, Office, JSON, `.zip`, Medien, `rules.md`, Kontextmonitor und `.json`-Sync / ChatGPT-Import.

## Vergleich mit ähnlichen Tools

| Funktion | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| Open Source & ohne Docker | **Ja (MIT)** | Nur CLI | Docker/Python | Closed | Schwerer | Gemischt |
| Direkt-Compare + Multi-Modell-Chat | **Ja** | Nein | Teilweise | Einzeln | Nein | Begrenzt |
| Hyper Mode + Journal & Skills `.md` | **Ja** | Nein | Nein | Nein | Nein | Nein |
| `.deb` / `.rpm` / `.AppImage` / `.pkg.tar.zst` / `.exe` / `.pkg` + PWA | **Alle Formate** | CLI | Web/Docker | Auswahl | Auswahl | Auswahl |

## Schnellstart & Build

```bash
# Ollama mit CORS starten
OLLAMA_ORIGINS=* ollama serve

# Aus Quellcode bauen
npm install --legacy-peer-deps && npm run build
```

Oder **`nimchesko-ai-studio-app.zip`** entpacken (`run-windows.bat` / `./run-linux.sh`) bzw. Desktop-Installer aus **Releases** laden.
