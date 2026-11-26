[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guía HTML Multilingüe (Se abre directamente en el navegador):** **[Abrir guía completa (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#es)** · **[Espejo Instantáneo (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#es)** · **[Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Espacio de trabajo local 100 % privado para **todos los modelos locales** (`.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` o **Ollama**) en estilo **borgoña y crema**, sin Docker ni nube obligatoria.

## Características Completas

- **Cualquier Modelo Local (`Models & Sync`):** Autodetección `/api/tags`, subida directa `.gguf`/`.bin`/`.safetensors` (`/api/blobs` + `/api/create`) y descargas `hf.co/...`.
- **Chat Multimodelo y Nombre Obligatorio (`Chat`):** Consulta varios modelos en el mismo hilo, exige nombre descriptivo y organiza en carpetas.
- **Comparación Lado a Lado (`Compare`):** Modo secuencial (ahorra VRAM) o paralelo con `tok/s`, latencia y exportación Markdown.
- **Hyper Mode:** Canalización Higher Architect -> Lower Builder con guardado automático `.md` en `Desktop/Hyper Mode Markdown Files`.
- **Journal & Skills:** Notas `Side A -> Side B`, enlaces y adjuntos guardados en `Desktop/Journal & Skill Mode` y acoplables al proyecto activo.
- **Subida Universal (`*/*`) y Proyectos Aislados:** Código, PDF, Office, JSON, `.zip`, multimedia, `rules.md`, monitor de contexto y respaldo `.json` / ChatGPT.

## Comparativa con Herramientas Similares

| Capacidad | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| Open Source y sin Docker | **Sí (MIT)** | Solo CLI | Docker/Python | Cerrado | Pesado | Mixto |
| Compare + Chat Multimodelo | **Sí** | No | Parcial | Uno a la vez | No | Limitado |
| Hyper Mode + Journal & Skills | **Sí** | No | No | No | No | No |
| `.deb`/`.rpm`/`.AppImage`/`.pkg.tar.zst`/`.exe`/`.pkg` + PWA | **Todos** | CLI | Web/Docker | Parcial | Parcial | Parcial |

## Inicio Rápido

```bash
OLLAMA_ORIGINS=* ollama serve
npm install --legacy-peer-deps && npm run build
```

También puedes extraer **`nimchesko-ai-studio-app.zip`** (`run-windows.bat` / `./run-linux.sh`) o instalar desde **Releases**.
