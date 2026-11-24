<div dir="rtl">

[English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

# nimchesko AI studio

> **راهنمای چندزبانه HTML (با تم زرشکی و کرم برنامه):** **[برای باز کردن یا دانلود `public/guide.html` اینجا کلیک کنید](public/guide.html)** *(دارای ۷ زبان و تغییر تم روشن/تاریک)*

محیط کاری هوشمند و کراس‌پلتفرم برای کار با مدل‌های لوکال **Ollama** (از جمله `gemma4:12b`، مدل‌های دانلودشده از Ollama و فایل‌های `Modelfile` / `.gguf`) با طراحی مینیمال **زرشکی و کرم** و نقوش معماری ایرانی.

## قابلیت‌های اصلی

- **پروژه‌های ایزوله:** هر پروژه دارای حافظه مستقل، فایل قوانین `rules.md`، فایل‌های منبع، تنظیمات پارامتر مدل و تاریخچه گفت‌وگوهای جداگانه است.
- **مدیریت مدل‌ها و همگام‌سازی (`Models & Sync`):** دانلود مستقیم مدل از Ollama (`/api/pull`)، مشاهده مشخصات (`/api/show`)، ایمپورت `Modelfile` / `.gguf`، خروجی و ادغام هوشمند بکاپ `.json`، اتصال فایل `.json` روی دیسک برای همگام‌سازی خودکار و ایمپورت چت‌های `.json` / `.md` / `.txt`.
- **ابزارهای بهره‌وری:** پوشه‌بندی کشیدن و رها کردن (Drag & Drop) در نوار کناری، کتابخانه پرامپت‌های سریع، مانیتورینگ زنده کانتکست، ذخیره خودکار و کلیدهای میانبر (`Cmd/Ctrl + Enter`، `Cmd/Ctrl + N`، `Cmd/Ctrl + K`).
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
npm install
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
