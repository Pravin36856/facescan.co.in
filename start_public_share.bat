@echo off
title FaceSnap AI - Public Internet Tunnel
echo ===================================================
echo   Starting Cloudflare Public Internet Tunnel...
echo ===================================================
echo This creates a live public HTTPS link for photographers to test on mobile.
echo.
cloudflared tunnel --url http://127.0.0.1:8000
pause
