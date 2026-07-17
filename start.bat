@echo off
title Bible Time - 31 Hari Hidup dalam Hikmat
echo ============================================================
echo   BIBLE TIME
echo   Proverbs Edition - Amsal 1-31 - 31 hari
echo ============================================================
echo.
echo   Membuka di http://localhost:8080 ...
echo   Tekan Ctrl+C untuk menghentikan server.
echo.

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:8080
  py -m http.server 8080
  goto :eof
)

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:8080
  npx --yes serve . -p 8080
  goto :eof
)

echo Tidak menemukan Python atau Node.js di sistemmu.
pause
