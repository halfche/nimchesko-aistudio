<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **راهنمای تعاملی و چندزبانه HTML (باز شدن مستقیم در مرورگر، بدون کد یا خطای 404):**
> - **[باز کردن راهنمای کامل (`guide.html` در GitHub Pages)](https://halfche.github.io/nimchesko-aistudio/#fa)** *(یا [guide.html#fa](https://halfche.github.io/nimchesko-aistudio/guide.html#fa) — دارای دکمه بازگشت به مخزن گیت‌هاب و اجرای برنامه)*
> - **[باز کردن فوری راهنما (آینه CDN)](https://raw.githack.com/halfche/nimchesko-aistudio/main/public/guide.html#fa)** · **[اجرای نسخه وب](https://halfche.github.io/nimchesko-aistudio/studio.html)** · **[نسخه‌های دسکتاپ](https://github.com/halfche/nimchesko-aistudio/releases)**
> - دارای ۷ زبان (فارسی، انگلیسی، عربی، آلمانی، اسپانیایی، فرانسوی، ترکی) + تم روشن/تاریک.

محیط کاری هوشمند و کراس‌پلتفرم برای کار با **تمام مدل‌های لوکال** (ایمپورت مستقیم از **فایل‌های محلی** مانند `.gguf`، `.bin`، `.safetensors`، `Modelfile` و `.json` یا کشف و دانلود از **Ollama**) به همراه محیط مقایسه هم‌زمان مدل‌ها، با طراحی مینیمال **زرشکی و کرم** و نقوش معماری ایرانی.

## قابلیت‌های اصلی

- **مقایسه همه مدل‌های لوکال (`Compare`):** اجرای هم‌زمان یا ترتیبی (بهینه برای VRAM) پرامپت روی تمام مدل‌های لوکال انتخاب‌شده، مشاهده مشخصات `/api/show`، مقایسه سرعت (`tok/s`)، تاخیر، تعداد توکن‌ها، خروجی گزارش Markdown و ادامه گفتگو در چت.
- **افزودن هر مدل لوکال (`Models & Sync`):** افزودن مدل از **فایل‌های محلی** (آپلود مستقیم وزن‌های `.gguf`/`.bin`/`.safetensors` به Ollama با `/api/blobs` و `/api/create` یا ایمپورت `Modelfile`/`.json`) و از **Ollama** (تشخیص خودکار `/api/tags`، ایمپورت یکجای همه مدل‌ها و دانلود از Ollama یا `hf.co/...`).
- **پروژه‌های ایزوله:** هر پروژه دارای حافظه مستقل، فایل قوانین `rules.md`، فایل‌های منبع، تنظیمات پارامتر مدل و تاریخچه گفت‌وگوهای جداگانه است.
- **ابزارهای بهره‌وری و همگام‌سازی:** بکاپ و ادغام هوشمند `.json`، اتصال فایل روی دیسک برای همگام‌سازی خودکار، ایمپورت چت‌های `.json`/`.md`/`.txt`، پوشه‌بندی Drag & Drop، پرامپت‌های سریع، مانیتورینگ زنده کانتکست، ذخیره خودکار و میانبرها (`Cmd/Ctrl + Enter`، `Cmd/Ctrl + N`، `Cmd/Ctrl + K`).
- **تم روشن و تاریک:** طراحی هماهنگ زرشکی و کرم به همراه فایل راهنمای مستقل `public/guide.html`.
- **خروجی کراس‌پلتفرم:** بسته آماده یکپارچه (`nimchesko-ai-studio-app.zip`) و بیلد خودکار دسکتاپ در GitHub Actions با فرمت‌های `.deb`، `.rpm`، `.pkg`، `.pkg.tar.zst`، `.tar`، `.tar.zst`، `.AppImage` و `.exe`.

## اجرای سریع (بسته آماده یکپارچه)

1. فایل **`nimchesko-ai-studio-app.zip`** را از نوار بالای برنامه یا بخش **Releases** گیت‌هاب دانلود و استخراج کنید.
2. اجرا:
   - **ویندوز:** روی `run-windows.bat` دابل‌کلیک کنید (به صورت خودکار از Python، Node.js یا PowerShell داخلی ویندوز استفاده می‌کند).
   - **لینوکس:** دستور `chmod +x run-linux.sh && ./run-linux.sh` را اجرا کنید.
3. پیش از استفاده، Ollama را با دسترسی CORS اجرا کنید:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

## ساخت و اجرای محلی از سورس

```bash
npm install --legacy-peer-deps
npm run dev      # اجرای محیط توسعه روی http://localhost:3000
npm run build    # کامپایل پوشه dist و ساخت فایل nimchesko-ai-studio-app.zip
```

## بیلد خودکار گیت‌هاب اکشنز (CI/CD)

فایل ورک‌فلو: `.github/workflows/release-desktop.yml`

پیش از اولین اجرا، در تنظیمات مخزن گیت‌هاب وارد **Settings ← Actions ← General ← Workflow permissions** شوید و گزینه **Read and write permissions** را فعال کنید.

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
