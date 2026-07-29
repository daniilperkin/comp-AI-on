$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   comp[AI]on launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Backend venv setup ---
if (-not (Test-Path -LiteralPath "backend\.venv\Scripts\python.exe")) {
  Write-Host "[setup] Creating Python virtualenv..." -ForegroundColor Yellow
  python -m venv "backend\.venv"
  if (-not $?) { Write-Host "[error] venv creation failed. Make sure Python 3.11+ is installed." -ForegroundColor Red; Read-Host; exit 1 }
}
Write-Host "[setup] Installing backend dependencies..." -ForegroundColor Yellow
& "backend\.venv\Scripts\python.exe" -m pip install -q -r "backend\requirements.txt"

# --- Frontend deps setup ---
if (-not (Test-Path -LiteralPath "frontend\node_modules")) {
  Write-Host "[setup] Installing frontend dependencies..." -ForegroundColor Yellow
  Push-Location "frontend"
  npm install
  Pop-Location
}

Write-Host ""
Write-Host "[start] Launching backend (port 8765) and frontend (port 6769)..." -ForegroundColor Green
Write-Host "[start] Close both windows to stop the app." -ForegroundColor Green
Write-Host ""

$backendCmd = "Set-Location -LiteralPath '$Root'; & '$Root\backend\.venv\Scripts\python.exe' -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8765"
$frontendCmd = "Set-Location -LiteralPath '$Root\frontend'; npm run dev"

Push-Location "C:\"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Start-Sleep -Seconds 2
Start-Process "http://localhost:6769"
Pop-Location
