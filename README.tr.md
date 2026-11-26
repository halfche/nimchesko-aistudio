[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Çok Dilli HTML Kılavuzu (Doğrudan Tarayıcıda Açılır):** **[Tam Kılavuzu Aç (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#tr)** · **[Anlık Ayna (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#tr)** · **[Web Stüdyo](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Sürümler](https://github.com/halfche/nimchesko-aistudio/releases)**

**Tüm yerel modelleri** (**yerel dosyalardan** `.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` veya **Ollama** üzerinden) içe aktarmak, çalıştırmak ve karşılaştırmak için minimalist **Bordo & Krem** temalı ve İran mimari motifli çok platformlu yerel yapay zeka çalışma alanı.

## Öne Çıkan Özellikler

- **Tüm Yerel Modelleri Karşılaştır (`Compare`):** İstemleri sıralı (VRAM dostu) veya paralel olarak yan yana çalıştırın, `/api/show` ayrıntılarını inceleyin, `tok/s` ve gecikmeleri karşılaştırıp Markdown olarak dışa aktarın.
- **Herhangi Bir Yerel Modeli İçe Aktar (`Models & Sync`):** Yerel ağırlık dosyalarını doğrudan Ollama'ya yükleyin (`/api/blobs` + `/api/create`), `Modelfile`/`.json` içe aktarın veya Ollama ile `hf.co/...` etiketlerini indirin (`/api/pull`).
- **İzole Projeler ve Verimlilik:** Ayrı `rules.md` kuralları, sürükle-bırak klasörler, Hızlı İstemler, canlı bağlam izleyici, otomatik kaydetme ve kısayollar (`Cmd/Ctrl + Enter`, `Cmd/Ctrl + N`, `Cmd/Ctrl + K`).
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
npm install --legacy-peer-deps
npm run build
```

`.github/workflows/release-desktop.yml` iş akışının otomatik Release oluşturabilmesi için **Settings → Actions → General → Workflow permissions** altından **Read and write permissions** seçeneğini etkinleştirin.
