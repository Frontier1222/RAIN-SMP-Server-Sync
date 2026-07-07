@echo off
title Deploy All Packs to PebbleHost
cd /d "%~dp0.vscode"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing deploy dependencies...
  call npm install
)
echo.
echo Uploading all managed packs...
call node deploy.js --pack all
echo.
if errorlevel 1 (
  echo Deploy failed.
  pause
  exit /b 1
)
echo Done. Restart the server from the PebbleHost panel.
pause
