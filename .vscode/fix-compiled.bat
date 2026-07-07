@echo off
cd /d "%~dp0"
node fix-compiled.js
exit /b %ERRORLEVEL%
