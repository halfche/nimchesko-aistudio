[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guide HTML Multilingue (Ouverture directe dans le navigateur) :** **[Ouvrir le guide complet (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#fr)** · **[Miroir Instantané (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#fr)** · **[Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Espace de travail IA 100 % local pour **tous vos modèles locaux** (`.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` ou **Ollama**) au design **Bordeaux & Crème**, sans Docker ni serveur complexe.

## Fonctionnalités Clés

- **Tout Modèle Local (`Models & Sync`) :** Détection `/api/tags`, téléversement direct `.gguf`/`.bin`/`.safetensors` (`/api/blobs` + `/api/create`) et `hf.co/...`.
- **Chat Multi-Modèles & Nommage Requis (`Chat`) :** Interrogez plusieurs modèles dans un même fil avec nommage obligatoire et dossiers.
- **Comparateur (`Compare`) :** Exécution séquentielle (VRAM) ou parallèle, `tok/s` et export Markdown.
- **Hyper Mode :** Pipeline Architecte -> Exécutant enregistré en `.md` dans `Desktop/Hyper Mode Markdown Files`.
- **Journal & Skills :** Ponts `Side A -> Side B`, liens et fichiers sauvegardés dans `Desktop/Journal & Skill Mode` et liés au projet actif.
- **Pièces Jointes Universelles (`*/*`) & Projets Isolés :** Code, PDF, Office, JSON, `.zip`, média, `rules.md`, moniteur de contexte et sync `.json` / ChatGPT.

## Comparatif Rapide

| Critère | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| Open Source sans Docker | **Oui (MIT)** | CLI | Docker/Python | Fermé | Lourd | Mixte |
| Compare + Chat Multi-Modèles | **Oui** | Non | Partiel | Unique | Non | Limité |
| Hyper Mode + Journal & Skills | **Oui** | Non | Non | Non | Non | Non |
| `.deb`/`.rpm`/`.AppImage`/`.pkg.tar.zst`/`.exe`/`.pkg` + PWA | **Tous** | CLI | Web/Docker | Partiel | Partiel | Partiel |

## Démarrage Rapide

```bash
OLLAMA_ORIGINS=* ollama serve
npm install --legacy-peer-deps && npm run build
```

Ou extrayez **`nimchesko-ai-studio-app.zip`** (`run-windows.bat` / `./run-linux.sh`) ou installez via **Releases**.
