<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **دليل HTML متعدد اللغات (يفتح مباشرة كصفحة ويب بدون عرض الكود):** **[فتح الدليل الكامل (GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#ar)** · **[المرآة الفورية (CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#ar)** · **[تشغيل الاستوديو](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[الإصدارات](https://github.com/halfche/nimchesko-aistudio/releases)**

بيئة عمل محلية ١٠٠٪ متعددة المنصات لتشغيل ومقارنة **جميع النماذج المحلية** (`.gguf`، `.bin`، `.safetensors`، `Modelfile`، `.json` أو عبر **Ollama**) بتصميم **العنابي والكريمي** وزخارف معمارية إيرانية بدون Docker أو سحابة.

## الميزات الرئيسية

- **استيراد أي نموذج محلي (`Models & Sync`):** اكتشاف `/api/tags` ورفع ملفات `.gguf`/`.bin`/`.safetensors` مباشرة عبر `/api/blobs` + `/api/create` أو سحب `hf.co/...`.
- **محادثة متعددة النماذج وتسمية إلزامية (`Chat`):** تشغيل عدة نماذج في نفس المحادثة مع تسمية إلزامية ومجلدات بالسحب والإفلات.
- **مقارنة جميع النماذج (`Compare`):** تشغيل متسلسل (موفر للذاكرة VRAM) أو متوازٍ، مقارنة `tok/s`، وتصدير Markdown.
- **وضع `Hyper Mode`:** دمج نموذج معماري أعلى مع نموذج تنفيذ أسرع وحفظ ملفات `.md` تلقائياً في `Desktop/Hyper Mode Markdown Files`.
- **وضع `Journal & Skills`:** إنشاء مهارات وجسور `Side A -> Side B` مع الروابط والمرفقات وحفظها في `Desktop/Journal & Skill Mode` وربطها بالمشروع.
- **رفع كافة الملفات (`*/*`) ومشاريع معزولة:** دعم PDF وOffice وJSON وZIP والأكواد والوسائط، مع `rules.md` ومزامنة `.json` واستيراد ChatGPT.

## مقارنة سريعة مع الأدوات المشابهة

| الميزة | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| مجاني ومفتوح المصدر (MIT) | **نعم** | نعم | ترخيص مخصص | مغلق | نعم | مختلط |
| بدون Docker / خادم ثقيل | **نعم** | CLI فقط | يتطلب Docker | تطبيق | أثقل | تطبيق |
| مقارنة شاملة + محادثة متعددة النماذج | **نعم** | لا | جزئي | لا | لا | محدود |
| `Hyper Mode` + `Journal & Skills` | **نعم** | لا | لا | لا | لا | لا |
| `.deb` / `.rpm` / `.AppImage` / `.pkg.tar.zst` / `.exe` / `.pkg` + PWA | **نعم** | CLI | ويب/Docker | جزئي | جزئي | جزئي |

## التشغيل السريع

1. نزّل **`nimchesko-ai-studio-app.zip`** وفك الضغط ثم شغّل `run-windows.bat` أو `chmod +x run-linux.sh && ./run-linux.sh`.
2. شغّل Ollama مع CORS:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
3. للبناء من المصدر: `npm install --legacy-peer-deps && npm run build`.

</div>
