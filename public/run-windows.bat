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

echo Python 3 or Node.js is required to serve the compiled web app.
pause
