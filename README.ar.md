<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **دليل HTML متعدد اللغات (يفتح مباشرة كصفحة ويب بدون عرض الكود):** **[فتح الدليل الكامل (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#ar)** · **[المرآة الفورية (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#ar)** · **[تشغيل الاستوديو](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[الإصدارات](https://github.com/halfche/nimchesko-aistudio/releases)**

مساحة عمل محلية متعددة المنصات لتشغيل ومقارنة **جميع النماذج المحلية** (الاستيراد من **الملفات المحلية** مثل `.gguf` و`.bin` و`.safetensors` و`Modelfile` و`.json` أو عبر **Ollama**) بتصميم بسيط بألوان **العنابي والكريمي**.

## الميزات الرئيسية

- **مقارنة جميع النماذج المحلية (`Compare`):** تشغيل الأوامر جنباً إلى جنب بالتتابع أو بالتوازي، فحص المواصفات (`/api/show`)، ومقارنة السرعة (`tok/s`) وزمن الاستجابة وتصدير التقارير.
- **استيراد أي نموذج محلي (`Models & Sync`):** إضافة النماذج من الملفات المحلية مباشرة إلى Ollama عبر `/api/blobs` و`/api/create` أو استيرادها وسحبها من Ollama (`/api/tags` و`/api/pull` و`hf.co/...`) مع مزامنة ملفات `.json`.
- **مشاريع معزولة وإنتاجية متقدمة:** قواعد `rules.md` مستقلة، مجلدات بالسحب والإفلات، مكتبة الأوامر السريعة، مراقبة السياق، والحفظ التلقائي واختصارات لوحة المفاتيح (`Cmd/Ctrl + Enter`، `Cmd/Ctrl + N`، `Cmd/Ctrl + K`).
- **تغليف متعدد المنصات:** حزمة ويب موحدة (`nimchesko-ai-studio-app.zip`) وبناء آلي عبر GitHub Actions بصيغ `.deb` و`.rpm` و`.pkg` و`.pkg.tar.zst` و`.tar` و`.tar.zst` و`.AppImage` و`.exe`.

## التشغيل السريع

1. نزّل **`nimchesko-ai-studio-app.zip`** وفك الضغط عنه.
2. **ويندوز:** انقر نقراً مزدوجاً على `run-windows.bat`. **لينكس:** نفّذ `chmod +x run-linux.sh && ./run-linux.sh`.
3. شغّل Ollama مع تفعيل CORS:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## البناء من المصدر وإصدارات GitHub Actions

```bash
npm install --legacy-peer-deps
npm run build
```

تأكد من تفعيل **Read and write permissions** تحت **Settings ← Actions ← General ← Workflow permissions** ليتمكن ملف `.github/workflows/release-desktop.yml` من إنشاء الإصدارات تلقائياً.

</div>
