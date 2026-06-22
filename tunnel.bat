@echo off
title IT Asset Manager - Cloudflare Tunnel
echo === IT Asset Manager - Cloudflare Tunnel ===
echo.
echo Iniciando tunnel hacia trycloudflare.com...
echo La URL aparecera abajo como https://XXXXX.trycloudflare.com
echo Presione Ctrl+C para detener.
echo.
"%LOCALAPPDATA%\cloudflared\cloudflared.exe" tunnel --url http://localhost:3131
pause
