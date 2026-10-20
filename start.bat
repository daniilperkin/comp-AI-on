@echo off
rem comp[AI]on - zero-window launcher. The PowerShell work happens hidden;
rem this window closes immediately. Logs land in logs\. Stop with stop.bat.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start.ps1"
