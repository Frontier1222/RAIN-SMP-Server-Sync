@echo off
cd /d "%~dp0"
node format-compiled.js
exit /b %ERRORLEVEL%
