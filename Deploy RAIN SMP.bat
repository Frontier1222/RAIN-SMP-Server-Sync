@echo off
title Deploy RAIN SMP to PebbleHost
cd /d "%~dp0.vscode"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing deploy dependencies...
  call npm.cmd install
)
echo.
echo Uploading RAIN SMP E BP + RAIN SMP E RP...
call npm.cmd run deploy:rain
echo.
if errorlevel 1 (
  echo Deploy failed.
  pause
  exit /b 1
)
echo Done. Restart the server from the PebbleHost panel.
pause
