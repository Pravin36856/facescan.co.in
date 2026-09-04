@echo off
title FaceSnap AI - Event Photo Sharing SaaS
echo ===================================================
echo   FaceSnap AI - Smart Photo Delivery Platform
echo ===================================================
echo Starting FastAPI Server with AI Face Engine...
cd backend
if not exist "venv\Scripts\python.exe" (
    echo Setting up Python virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo.
echo Server starting at http://localhost:8000
echo Open your browser at: http://localhost:8000
echo.
python main.py
pause
