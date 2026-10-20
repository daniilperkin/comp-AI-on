@echo off
rem Runs the comp[AI]on backend (used by start.ps1; extra args go to uvicorn).
cd /d "%~dp0.."
"%~dp0..\backend\.venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 %*
