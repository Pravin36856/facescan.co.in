@echo off
cd /d "%~dp0"
echo Starting FaceSnap AI Backend and Tunnel...

:: 1. Free port 8000 if old instance is stuck
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start Python Backend
start "" /B "%~dp0backend\venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir "%~dp0backend"

:: Wait 3 seconds
ping 127.0.0.1 -n 4 >nul

:: Start Cloudflare Tunnel
start "" /B "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe" tunnel --edge-ip-version 4 --protocol http2 --url http://127.0.0.1:8000
