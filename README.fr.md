[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guide HTML multilingue (thème Bordeaux & Crème) :** **[Ouvrir / Télécharger `public/guide.html`](public/guide.html)**

Espace de travail IA local multiplateforme pour **Ollama** (`gemma4:12b`, modèles locaux, `Modelfile` et `.gguf`), conçu avec une esthétique minimaliste **Bordeaux & Crème** et des motifs architecturaux iraniens.

## Fonctionnalités Clés

- **Projets Isolés :** Règles (`rules.md`), fichiers ressources, connecteurs système, paramètres et historiques séparés par projet.
- **Modèles & Synchronisation (`Models & Sync`) :** Téléchargement depuis Ollama (`/api/pull`), inspection (`/api/show`), import `Modelfile` / `.gguf`, export et fusion `.json`.
- **Productivité :** Dossiers glisser-déposer, bibliothèque Quick Prompts, moniteur de contexte, sauvegarde automatique et raccourcis (`Cmd/Ctrl + Entrée`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Paquets Multiplateformes :** Archive web (`nimchesko-ai-studio-app.zip`) et builds GitHub Actions CI/CD (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Démarrage Rapide

1. Téléchargez et extrayez **`nimchesko-ai-studio-app.zip`**.
2. **Windows :** double-cliquez sur `run-windows.bat`. **Linux :** exécutez `chmod +x run-linux.sh && ./run-linux.sh`.
3. Démarrez Ollama avec CORS activé :
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
