[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guide HTML Multilingue (Ouverture directe dans le navigateur) :** **[Ouvrir le guide complet (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#fr)** · **[Miroir Instantané (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#fr)** · **[Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Espace de travail IA local multiplateforme pour exécuter, importer et comparer **tous les modèles locaux** (depuis des **fichiers locaux** `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` ou via **Ollama**), conçu avec une esthétique minimaliste **Bordeaux & Crème** et des motifs architecturaux iraniens.

## Fonctionnalités Clés

- **Comparer tous les modèles locaux (`Compare`) :** Exécutez des prompts côte à côte en mode séquentiel ou parallèle, inspectez `/api/show`, comparez les `tok/s` et latences, et exportez en Markdown.
- **Importer tout modèle local (`Models & Sync`) :** Chargez des fichiers de poids locaux dans Ollama (`/api/blobs` + `/api/create`), importez des `Modelfile`/`.json` ou téléchargez depuis Ollama et `hf.co/...` (`/api/pull`), avec synchronisation `.json`.
- **Projets Isolés & Productivité :** Règles (`rules.md`), dossiers glisser-déposer, Quick Prompts, moniteur de contexte, sauvegarde automatique et raccourcis (`Cmd/Ctrl + Entrée`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Paquets Multiplateformes :** Archive web (`nimchesko-ai-studio-app.zip`) et builds GitHub Actions CI/CD (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Démarrage Rapide

1. Téléchargez et extrayez **`nimchesko-ai-studio-app.zip`**.
2. **Windows :** double-cliquez sur `run-windows.bat`. **Linux :** exécutez `chmod +x run-linux.sh && ./run-linux.sh`.
3. Démarrez Ollama avec CORS activé :
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
