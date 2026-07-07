@echo off
cd /d "%~dp0.vscode"
echo Syncing Shared development BP into server sync (BP only, not RP)...
node sync-from-dev.js --bp-only
if errorlevel 1 (
  echo Sync failed.
  pause
  exit /b 1
)
echo.
echo Done. Review changes, then deploy with Deploy RAIN SMP.bat
pause
