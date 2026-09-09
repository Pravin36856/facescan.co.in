@echo off
title FaceScan AI - Smart Photo Sharing SaaS
cd /d "%~dp0"

echo ================================================================
echo        FaceScan AI - Smart Photo Delivery Platform
echo ================================================================
echo.

:: 1. Free port 8000 if an old instance is stuck
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [INFO] Purana instance port 8000 par chal raha tha (PID %%a). Closing it...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Check virtual environment python
set PYTHON_EXE="%~dp0backend\venv\Scripts\python.exe"
if not exist %PYTHON_EXE% (
    echo [SETUP] Virtual environment setup kiya ja raha hai...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd ..
)

echo.
echo [1/2] Server starting at: http://localhost:8000
echo [2/2] Browser me website automatically open ho rahi hai...
echo.

:: 3. Open browser after 3 seconds in background
start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:8000"

:: 4. Start Python server directly using venv python
cd backend
"%~dp0backend\venv\Scripts\python.exe" main.py

pause

