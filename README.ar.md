<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **دليل HTML متعدد اللغات (الواجهة التفاعلية):** **[فتح الدليل التفاعلي مباشرة](https://htmlpreview.github.io/?https://github.com/halfche/nimchesko-aistudio/blob/main/public/guide.html?lang=ar)** · **[GitHub Pages](https://halfche.github.io/nimchesko-aistudio/guide.html?lang=ar)** · [`public/guide.html`](public/guide.html)

مساحة عمل محلية متعددة المنصات لتشغيل نماذج **Ollama** (`gemma4:12b`، والنماذج المحلية، وملفات `Modelfile` / `.gguf`) بتصميم بسيط بألوان **العنابي والكريمي**.

## الميزات الرئيسية

- **مشاريع معزولة:** بيئة مستقلة لكل مشروع تشمل ملف القواعد `rules.md`، والموارد النصية، وإعدادات النموذج، وسجل المحادثات.
- **إدارة النماذج والمزامنة (`Models & Sync`):** سحب النماذج من Ollama (`/api/pull`)، وفحصها (`/api/show`)، واستيراد `Modelfile` و`.gguf`، وتصدير ودمج حزم المزامنة `.json`، وربط ملف محلي للمزامنة التلقائية.
- **إنتاجية متقدمة:** مجلدات جانبية بالسحب والإفلات، ومكتبة الأوامر السريعة، ومراقبة السياق المباشرة، والحفظ التلقائي، واختصارات لوحة المفاتيح (`Cmd/Ctrl + Enter`، `Cmd/Ctrl + N`، `Cmd/Ctrl + K`).
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
npm install
npm run build
```

تأكد من تفعيل **Read and write permissions** تحت **Settings ← Actions ← General ← Workflow permissions** ليتمكن ملف `.github/workflows/release-desktop.yml` من إنشاء الإصدارات تلقائياً.

</div>
