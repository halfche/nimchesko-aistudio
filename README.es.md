[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Guía HTML Multilingüe (Interfaz Renderizada):** **[Abrir guía interactiva ahora](https://htmlpreview.github.io/?https://github.com/halfche/nimchesko-aistudio/blob/main/public/guide.html?lang=es)** · **[GitHub Pages](https://halfche.github.io/nimchesko-aistudio/guide.html?lang=es)** · [`public/guide.html`](public/guide.html)

Espacio de trabajo local multiplataforma para **Ollama** (`gemma4:12b`, modelos locales, `Modelfile` y `.gguf`), diseñado con una estética minimalista en **borgoña y crema** y motivos arquitectónicos persas.

## Características Principales

- **Proyectos Aislados:** Reglas propias (`rules.md`), archivos de recursos, conectores del sistema, parámetros de modelo e historiales separados por proyecto.
- **Modelos y Sincronización (`Models & Sync`):** Descarga modelos de Ollama (`/api/pull`), inspecciona (`/api/show`), importa `Modelfile` / `.gguf`, exporta o fusiona copias `.json` e importa chats `.json`, `.md` y `.txt`.
- **Productividad:** Carpetas arrastrables en la barra lateral, biblioteca de Quick Prompts, monitor de contexto en vivo, autoguardado y atajos (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
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
npm install
npm run build
```

Activa **Read and write permissions** en **Settings → Actions → General → Workflow permissions** para que `.github/workflows/release-desktop.yml` publique automáticamente todos los instaladores en **Releases**.
