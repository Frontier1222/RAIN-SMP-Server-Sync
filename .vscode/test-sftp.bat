@echo off
cd /d "%~dp0"
echo.
echo PebbleHost SFTP login test
echo Host: na2041.pebblehost.net:2222
echo User: ksyed1324@gmail.com.588b5a1a
echo.
echo Enter your PebbleHost panel password when ssh asks for it.
echo Nothing shows while you type - that is normal.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-sftp.ps1"
pause
