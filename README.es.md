[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guía HTML Multilingüe (Se abre directamente en el navegador):** **[Abrir guía completa (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#es)** · **[Espejo Instantáneo (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#es)** · **[Web Studio](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Releases](https://github.com/halfche/nimchesko-aistudio/releases)**

Espacio de trabajo local multiplataforma para ejecutar, importar y comparar **todos los modelos locales** (desde **archivos locales** como `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` o mediante **Ollama**), diseñado con una estética minimalista en **borgoña y crema** y motivos arquitectónicos persas.

## Características Principales

- **Comparar todos los modelos locales (`Compare`):** Ejecuta prompts en paralelo o secuencialmente, inspecciona detalles (`/api/show`), compara `tok/s`, latencia y tokens, exporta informes Markdown y continúa en el chat.
- **Importar cualquier modelo local (`Models & Sync`):** Carga archivos locales directamente en Ollama (`/api/blobs` + `/api/create`), importa `Modelfile`/`.json` o descarga etiquetas de Ollama y `hf.co/...` (`/api/pull`), además de sincronizar respaldos `.json` y chats.
- **Proyectos Aislados y Productividad:** Reglas propias (`rules.md`), carpetas arrastrables, Quick Prompts, monitor de contexto, autoguardado y atajos (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Empaquetado Multiplataforma:** Paquete web combinado (`nimchesko-ai-studio-app.zip`) y compilación automática en GitHub Actions CI/CD (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Inicio Rápido

1. Descarga y extrae **`nimchesko-ai-studio-app.zip`**.
2. **Windows:** Haz doble clic en `run-windows.bat`. **Linux:** Ejecuta `chmod +x run-linux.sh && ./run-linux.sh`.
3. Inicia Ollama permitiendo peticiones del navegador:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## Compilación Local y GitHub Actions CI/CD

```bash
npm install --legacy-peer-deps
npm run build
```

Activa **Read and write permissions** en **Settings → Actions → General → Workflow permissions** para que `.github/workflows/release-desktop.yml` publique automáticamente todos los instaladores en **Releases**.
