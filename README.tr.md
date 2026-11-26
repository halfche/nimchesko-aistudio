[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **Çok Dilli HTML Kılavuzu (Doğrudan Tarayıcıda Açılır):** **[Tam Kılavuzu Aç (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#tr)** · **[Anlık Ayna (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#tr)** · **[Web Stüdyo](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[Sürümler](https://github.com/halfche/nimchesko-aistudio/releases)**

**Tüm yerel modeller** (`.gguf`, `.bin`, `.safetensors`, `Modelfile`, `.json` veya **Ollama**) için **Bordo & Krem** tasarımlı, Docker ve bulut gerektirmeyen %100 yerel yapay zeka çalışma alanı.

## Tüm Özellikler

- **Her Yerel Model (`Models & Sync`):** `/api/tags` algılama, `/api/blobs` + `/api/create` ile doğrudan `.gguf`/`.bin`/`.safetensors` yükleme ve `hf.co/...` indirme.
- **Çoklu Model Sohbet ve Zorunlu Adlandırma (`Chat`):** Aynı sohbette birden çok modeli çalıştırma, zorunlu sohbet adı ve sürükle-bırak klasörler.
- **Karşılaştırma (`Compare`):** VRAM korumalı Sıralı veya Paralel çalıştırma, `tok/s` karşılaştırması ve Markdown dışa aktarma.
- **Hyper Mode:** Üst Mimar -> Alt Uygulayıcı ikili model hattı ve `Desktop/Hyper Mode Markdown Files` içine otomatik `.md` kaydı.
- **Journal & Skills:** `Side A -> Side B` köprüleri, bağlantılar ve dosyalar ile `Desktop/Journal & Skill Mode` kaydı ve aktif projeye bağlama.
- **Evrensel Dosya Yükleme (`*/*`) ve İzole Projeler:** Kod, PDF, Office, JSON, `.zip`, medya, `rules.md`, canlı bağlam izleyici ve `.json` eşitleme / ChatGPT içe aktarma.

## Benzer Araçlarla Karşılaştırma

| Özellik | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| Açık Kaynak ve Docker'sız | **Evet (MIT)** | Sadece CLI | Docker/Python | Kapalı | Ağır | Karma |
| Compare + Çoklu Model Sohbet | **Evet** | Yok | Kısmi | Tek Model | Yok | Sınırlı |
| Hyper Mode + Journal & Skills | **Evet** | Yok | Yok | Yok | Yok | Yok |
| `.deb`/`.rpm`/`.AppImage`/`.pkg.tar.zst`/`.exe`/`.pkg` + PWA | **Tümü** | CLI | Web/Docker | Kısmi | Kısmi | Kısmi |

## Hızlı Başlangıç

```bash
OLLAMA_ORIGINS=* ollama serve
npm install --legacy-peer-deps && npm run build
```

Veya **`nimchesko-ai-studio-app.zip`** arşivini çıkarın (`run-windows.bat` / `./run-linux.sh`) ya da **Releases** bölümünden masaüstü sürümünü indirin.
