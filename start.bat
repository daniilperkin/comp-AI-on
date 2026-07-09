@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================
echo   comp[AI]on launcher
echo ============================================
echo.

REM --- Backend venv setup ---
if not exist "backend\.venv" (
  echo [setup] Creating Python virtualenv...
  python -m venv "backend\.venv"
)
if not exist "backend\.venv\Scripts\python.exe" (
  echo [error] Failed to create virtualenv. Make sure Python 3.11+ is installed.
  pause
  exit /b 1
)
echo [setup] Installing backend dependencies...
"backend\.venv\Scripts\python.exe" -m pip install -q -r "backend\requirements.txt"

REM --- Frontend deps setup ---
if not exist "frontend\node_modules" (
  echo [setup] Installing frontend dependencies...
  pushd "frontend"
  call npm install
  popd
)

echo.
echo [start] Launching backend (port 8765) and frontend (port 6769)...
echo [start] Close both windows to stop the app.
echo.

start "comp[AI]on - Backend" cmd /k "cd /d "%ROOT%" && "backend\.venv\Scripts\python.exe" -m uvicorn backend.main:app --reload --port 8765"
timeout /t 2 /nobreak >nul
start "comp[AI]on - Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"
timeout /t 2 /nobreak >nul
start http://localhost:6769

endlocal
