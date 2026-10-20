@echo off
rem Runs the comp[AI]on frontend dev server (used by start.ps1).
cd /d "%~dp0..\frontend"
call npm run dev
