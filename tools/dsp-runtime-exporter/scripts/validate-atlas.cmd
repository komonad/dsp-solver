@echo off
setlocal
node "%~dp0validate-atlas.mjs" %*
exit /b %errorlevel%
