@echo off
cd /d "%~dp0"
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
echo Deploying manifests to PebbleHost...
call npm run deploy:manifests
pause
