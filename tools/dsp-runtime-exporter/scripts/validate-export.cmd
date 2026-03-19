@echo off
setlocal
chcp 65001 >nul
set ROOT=%~dp0..
node "%ROOT%\scripts\validate-export.mjs" %*
endlocal
