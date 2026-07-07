@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
)
echo.
echo Stop the Bedrock server in PebbleHost before continuing.
pause
node _fix_world_errors.js
pause
