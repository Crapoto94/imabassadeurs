@echo off
REM Deploiement du frontend DMZ (build local + copie SSH, sans git). Lit pulldmz.ini (local, ignore par git).
TITLE Deploiement DMZ
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pulldmz.ps1"
echo.
pause
