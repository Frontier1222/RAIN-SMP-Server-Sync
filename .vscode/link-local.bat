@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
if "%~1"=="" (
  echo Linking RAIN SMP + Essentials packs for local testing...
  node link-local.js --pack all
) else (
  node link-local.js %*
)
if errorlevel 1 pause
