@echo off
title FaceScan AI - Public Internet Mobile Link
cd /d "%~dp0"
echo ===================================================
echo   Starting Cloudflare Public Internet Tunnel...
echo ===================================================
echo Yeh photographers aur clients ke mobile me test karne ke liye live link banata hai.
echo.

set CF_BIN=cloudflared
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe" (
    set CF_BIN="%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"
)

%CF_BIN% tunnel --url http://127.0.0.1:8000
pause
