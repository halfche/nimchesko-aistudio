<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **راهنمای تعاملی و چندزبانه HTML (باز شدن مستقیم در مرورگر، بدون نمایش کد یا خطای 404):**
> - **[باز کردن راهنمای کامل (`guide.html` در GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#fa)** *(یا [guide.html#fa](https://halfche.github.io/nimchesko-aistudio/guide.html#fa) — دارای دکمه بازگشت به مخزن گیت‌هاب و اجرای برنامه)*
> - **[باز کردن فوری راهنما (آینه CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#fa)** · **[اجرای نسخه وب](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[نسخه‌های دسکتاپ](https://github.com/halfche/nimchesko-aistudio/releases)**
> - دارای ۷ زبان (فارسی، انگلیسی، عربی، آلمانی، اسپانیایی، فرانسوی، ترکی) + تم روشن/تاریک.

## پروژه nimchesko AI studio چیست؟

**nimchesko AI studio** یک محیط کاری ۱۰۰٪ محلی، مستقل از مدل و کراس‌پلتفرم برای کار با **تمام مدل‌های لوکال** (فایل‌های محلی `.gguf`، `.bin`، `.safetensors`، `Modelfile` و `.json` یا مدل‌های **Ollama**) است که با React، TypeScript، Vite و Electron و طراحی مینیمال **زرشکی و کرم** و نقوش معماری ایرانی ساخته شده و بدون نیاز به Docker یا سرویس ابری اجرا می‌شود.

## قابلیت‌های کامل

- **پشتیبانی از هر مدل لوکال (`Models & Sync`):** تشخیص خودکار `/api/tags`، آپلود مستقیم فایل‌های `.gguf` / `.bin` / `.safetensors` به Ollama با `/api/blobs` + `/api/create`، ایمپورت `Modelfile`/`.json` و دانلود مدل‌ها از Ollama یا `hf.co/...`.
- **چت چندمدله و نام‌گذاری اجباری (`Chat`):** انتخاب هم‌زمان چند مدل در یک گفت‌وگو، الزام نام‌گذاری چت‌ها (با پیشنهاد خودکار عنوان)، نمایش زنده سرعت `tok/s` و پوشه‌بندی Drag & Drop.
- **مقایسه همه مدل‌های لوکال (`Compare`):** اجرای ترتیبی (بهینه برای VRAM) یا موازی روی تمام مدل‌های انتخاب‌شده، مقایسه `tok/s` و تاخیر، خروجی Markdown و ادامه گفتگو در چت.
- **حالت هایپر (`Hyper Mode`):** ترکیب مدل معمار قوی‌تر (Higher) با مدل اجرایی سریع‌تر (Lower)، تولید فایل فنی `.md` به زبان انتخابی (فارسی، انگلیسی، کد و...) و ذخیره خودکار در پوشه `Desktop/Hyper Mode Markdown Files`.
- **ژورنال و مهارت (`Journal & Skills`):** ساخت یادداشت و پل‌های کاری `Side A -> Side B` به همراه لینک و فایل‌های پیوست، تبدیل به مهارت Markdown با مدل لوکال، ذخیره در `Desktop/Journal & Skill Mode` و اتصال یک‌کلیکی به پروژه فعال.
- **آپلود همه‌جانبه فایل (`*/*`):** پشتیبانی از کد، Markdown، PDF، آفیس (`.docx`، `.xlsx`، `.csv`)، JSON، آرشیو `.zip`، تصویر، صدا و ویدیو در تمام تب‌ها و پوشه‌های Drag & Drop.
- **پروژه‌های ایزوله (`Projects`):** `rules.md`، منابع، متغیرهای محیطی و تنظیمات پارامتر مدل (`temperature`، `num_ctx`، `top_p`) مجزا برای هر پروژه.
- **بکاپ، مانیتور کانتکست و تم:** خروجی و ادغام `.json`، ایمپورت `conversations.json` مربوط به ChatGPT، مانیتورینگ زنده کانتکست و تم روشن/تاریک زرشکی و کرم.

## مقایسه با ابزارهای مشابه

| قابلیت | **nimchesko AI studio** | Ollama CLI | Open WebUI | LM Studio | AnythingLLM | Jan / Msty |
| --- | --- | --- | --- | --- | --- | --- |
| رایگان و متن‌باز (MIT) | **بله (MIT)** | بله (MIT) | لایسنس اختصاصی | کد بسته | بله (MIT) | ترکیبی |
| بدون نیاز به Docker / سرور | **بله (وب / دسکتاپ / `.zip`)** | فقط ترمینال | نیازمند Docker/Python | دسکتاپ | سنگین‌تر | دسکتاپ |
| Ollama + آپلود مستقیم `.gguf` | **بله (کامل)** | CLI | فقط Ollama | داخلی | غیرمستقیم | داخلی |
| مقایسه چند مدل با حالت بهینه VRAM | **بله (`Compare`)** | ندارد | دوپنجره‌ای | تک‌مدله | ندارد | محدود (Msty) |
| پاسخ چند مدل در یک چت واحد | **بله** | ندارد | جزئی | تک‌مدله | تک‌مدله | تک‌مدله |
| پایپلاین `Hyper Mode` ← `.md` روی دسکتاپ | **بله (خودکار)** | ندارد | ندارد | ندارد | ندارد | ندارد |
| مهارت‌نویسی `Journal & Skills` متصل به پروژه | **بله (خودکار)** | ندارد | فقط پرامپت | ندارد | اسناد | ندارد |
| آپلود همه‌جانبه `*/*` در همه تب‌ها | **بله** | مسیر دستی | RAG | متن و تصویر | RAG | محدود |
| `.deb` / `.rpm` / `.AppImage` / `.pkg.tar.zst` / `.exe` / `.pkg` + PWA | **بله (تمامی فرمت‌ها)** | CLI | وب/Docker | محدودتر | محدودتر | محدودتر |

## اجرای سریع (بسته `.zip`)

1. فایل **`nimchesko-ai-studio-app.zip`** را دانلود و استخراج کنید.
2. **ویندوز:** روی `run-windows.bat` دابل‌کلیک کنید. **لینوکس:** `chmod +x run-linux.sh && ./run-linux.sh` را اجرا کنید.
3. پیش از استفاده، Ollama را با دسترسی CORS اجرا کنید:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## ساخت از سورس و بیلد خودکار گیت‌هاب

```bash
npm install --legacy-peer-deps
npm run dev
npm run build
```

در مخزن گیت‌هاب تحت **Settings ← Actions ← General ← Workflow permissions** گزینه **Read and write permissions** و در **Settings ← Pages** گزینه **GitHub Actions** را فعال کنید.

| سیستم‌عامل / توزیع | فرمت خروجی | روش نصب / اجرا |
| --- | --- | --- |
| اوبونتو / دبیان | `.deb` | `sudo apt install ./nimchesko-ai-studio-*.deb` |
| فدورا / ردهت / اوپن‌سوزه | `.rpm` | `sudo dnf install ./nimchesko-ai-studio-*.rpm` |
| آرچ لینوکس | `.pkg.tar.zst` | `sudo pacman -U ./nimchesko-ai-studio-*.pkg.tar.zst` |
| لینوکس عمومی | `.AppImage`, `.tar`, `.tar.zst` | `chmod +x *.AppImage && ./*.AppImage` |
| ویندوز | `.exe` (نصاب و قابل حمل) | اجرای فایل `.exe` |
| مک‌اواس | `.pkg` | اجرای نصاب `.pkg` |
| بسته وب / PWA | `.zip` | استخراج و اجرای `run-windows.bat` یا `run-linux.sh` |

</div>
