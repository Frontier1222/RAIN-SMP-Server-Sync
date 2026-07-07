@echo off
cd /d "%~dp0.vscode"
echo Restoring local Minecraft dev packs from Shared (no server patches)...
node sync-to-local-dev.js
if errorlevel 1 (
  echo Restore failed.
  pause
  exit /b 1
)
echo.
echo Local dev is separate from server sync again. Deploy still uses behavior_packs\ in this repo.
pause
