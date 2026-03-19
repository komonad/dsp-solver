@echo off
setlocal
chcp 65001 >nul
set ROOT=%~dp0..
set DOTNET_CLI_HOME=%ROOT%\.dotnet-cli
set DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
set DOTNET_NOLOGO=1
dotnet msbuild "%ROOT%\DspCalc.RuntimeExporter.csproj" /t:Package /p:Configuration=Release /v:m
endlocal
