@echo off
set "TARGET_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%~dp0auto_start_service.vbs" "%TARGET_DIR%\StartFaceSnapAI.vbs" >nul
echo =========================================================
echo FaceSnap AI Auto-Start Installed Successfully!
echo Ab computer restart hone par bhi server background me
echo automatically chalu ho jayega!
echo =========================================================
