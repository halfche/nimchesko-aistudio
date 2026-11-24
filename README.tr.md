[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Çok Dilli HTML Kılavuzu (Uygulama Temasıyla):** **[`public/guide.html` için buraya tıklayın](public/guide.html)**

**Ollama** (`gemma4:12b`, yerel modeller, `Modelfile` ve `.gguf`) için minimalist **Bordo & Krem** temalı ve İran mimari motifli çok platformlu yerel yapay zeka çalışma alanı.

## Öne Çıkan Özellikler

- **İzole Projeler:** Her proje için ayrı `rules.md` kuralları, kaynak dosyaları, sistem bağlayıcıları, model parametreleri ve sohbet geçmişi.
- **Modeller ve Eşitleme (`Models & Sync`):** Ollama'dan model indirin (`/api/pull`), inceleyin (`/api/show`), `Modelfile` / `.gguf` içe aktarın, `.json` eşitleme paketlerini dışa aktarın veya birleştirin.
- **Verimlilik:** Sürükle-bırak klasörler, Hızlı İstemler (Quick Prompts), canlı bağlam izleyici, otomatik kaydetme ve klavye kısayolları (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
- **Çok Platformlu Paketleme:** Tek tıkla birleştirilmiş web paketi (`nimchesko-ai-studio-app.zip`) ve GitHub Actions CI/CD masaüstü derlemeleri (`.deb`, `.rpm`, `.pkg`, `.pkg.tar.zst`, `.tar`, `.tar.zst`, `.AppImage`, `.exe`).

## Hızlı Başlangıç

1. **`nimchesko-ai-studio-app.zip`** dosyasını indirin ve arşivden çıkarın.
2. **Windows:** `run-windows.bat` dosyasına çift tıklayın. **Linux:** `chmod +x run-linux.sh && ./run-linux.sh` komutunu çalıştırın.
3. Ollama'yı CORS izniyle başlatın:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## Yerel Derleme ve GitHub Actions CI/CD

```bash
npm install
npm run build
```

`.github/workflows/release-desktop.yml` iş akışının otomatik Release oluşturabilmesi için **Settings → Actions → General → Workflow permissions** altından **Read and write permissions** seçeneğini etkinleştirin.
