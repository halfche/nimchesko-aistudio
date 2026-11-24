@echo off
setlocal
cd /d "%~dp0"
set PORT=4173

echo Starting nimchesko AI studio on http://localhost:%PORT%
start "" "http://localhost:%PORT%"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  npx --yes serve -s . -l %PORT%
  goto :eof
)

echo Python/Node not found; starting built-in Windows PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Get-Location).Path;" ^
  "$listener = New-Object System.Net.HttpListener;" ^
  "$listener.Prefixes.Add('http://127.0.0.1:%PORT%/');" ^
  "$listener.Start();" ^
  "$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.mjs'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.webmanifest'='application/manifest+json; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon'; '.txt'='text/plain; charset=utf-8' };" ^
  "Write-Host 'Serving nimchesko AI studio on http://127.0.0.1:%PORT% (Ctrl+C to stop)';" ^
  "while ($listener.IsListening) {" ^
  "  $ctx = $listener.GetContext();" ^
  "  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'));" ^
  "  if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' };" ^
  "  $file = Join-Path $root ($rel -replace '/', '\');" ^
  "  if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root 'index.html' };" ^
  "  $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant();" ^
  "  $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' };" ^
  "  $bytes = [System.IO.File]::ReadAllBytes($file);" ^
  "  $ctx.Response.ContentLength64 = $bytes.Length;" ^
  "  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length);" ^
  "  $ctx.Response.OutputStream.Close();" ^
  "}"
