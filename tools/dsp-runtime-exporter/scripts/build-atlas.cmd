@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-atlas.ps1" %*
exit /b %errorlevel%

