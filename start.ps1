param([switch]$Windowed)

# comp[AI]on launcher.
#   (default)   start both servers WITHOUT console windows, log to logs/, open
#               the browser, exit. Stop with stop.bat / stop.ps1.
#   -Windowed   run backend + frontend in THIS console (one window, Ctrl+C
#               stops both) - for development with hot reload.
#
# Two hard-won rules for this repo path ("comp[AI]on"):
#  1. Keep this file pure ASCII. PowerShell 5.1 reads .ps1 as ANSI unless there
#     is a UTF-8 BOM; a non-ASCII dash inside a string becomes garbage bytes
#     with a stray quote and breaks parsing.
#  2. Never hand paths under the repo to Start-Process: it wildcard-resolves
#     -FilePath / -WorkingDirectory / -RedirectStandardOutput and the brackets
#     fail (8.3 short names are disabled on this volume). ProcessStartInfo takes
#     plain strings, so everything is launched through it.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

$PythonExe = Join-Path $Root "backend\.venv\Scripts\python.exe"
$FrontendDir = Join-Path $Root "frontend"
$LogDir = Join-Path $Root "logs"
$BackendBat = Join-Path $Root "scripts\run-backend.bat"
$FrontendBat = Join-Path $Root "scripts\run-frontend.bat"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log([string]$Message) {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath (Join-Path $LogDir "launcher.log") -Value $line
  if ($Windowed) { Write-Host $Message }
}

function Test-Port([string]$HostName, [int]$Port) {
  # Raw TCP check: Invoke-WebRequest honours the system proxy (PS 5.1 has no
  # -NoProxy) and would fail on localhost behind one.
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(500)) { return $false }
    $client.EndConnect($iar)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-Port([string]$HostName, [int]$Port, [int]$Attempts = 60) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    if (Test-Port $HostName $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# Vite binds "localhost" and Windows may resolve that to ::1 while uvicorn
# listens on 127.0.0.1 - accept either stack.
function Wait-AnyPort([int]$Port, [int]$Attempts = 60) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    if ((Test-Port "127.0.0.1" $Port) -or (Test-Port "::1" $Port)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# Launch cmd.exe /c <command line>; paths are passed verbatim (no wildcard
# resolution). Hidden launches use ShellExecute so the child inherits none of
# this process's handles (otherwise a caller's pipe stays open until the
# servers exit); windowed launches share this console instead.
# Launch a hidden cmd.exe /c <command line>. Uses WScript.Shell.Run (COM /
# ShellExecute) because Start-Process and raw ProcessStartInfo both misbehave
# here: Start-Process wildcard-resolves paths under "comp[AI]on", and a
# ProcessStartInfo child launched from this script never actually ran the batch
# file. COM Run takes the command line verbatim and inherits no handles.
function Start-HiddenCmd([string]$CommandLine) {
  $wsh = New-Object -ComObject WScript.Shell
  # No trailing quote: the command line already ends with the redirection, and
  # a stray closing quote would be passed as an extra argument to the batch
  # file (uvicorn then dies with "unexpected extra argument").
  $line = 'cmd.exe /c call "' + $CommandLine
  Add-Content -LiteralPath (Join-Path $LogDir "launcher.log") -Value ("[debug-cmd] " + $line)
  [void]$wsh.Run($line, 0, $false)
}

# Windowed launches share this console (visible output, Ctrl+C stops both).
function Start-Cmd([string]$CommandLine) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = '/c ""' + $CommandLine + '"'
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $false
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  return $p
}

$mode = "hidden"
if ($Windowed) { $mode = "windowed" }
Write-Log "[start] comp[AI]on launcher ($mode)"

# --- setup: venv + dependencies (quiet; output goes to logs/setup.log) ---
if (-not (Test-Path -LiteralPath $PythonExe)) {
  Write-Log "[setup] creating Python virtualenv"
  python -m venv (Join-Path $Root "backend\.venv")
  if (-not (Test-Path -LiteralPath $PythonExe)) {
    Write-Log "[error] venv creation failed - is Python 3.11+ on PATH?"
    if (-not $Windowed) { Start-Process notepad.exe (Join-Path $LogDir "launcher.log") }
    exit 1
  }
}

Write-Log "[setup] installing backend dependencies"
$SetupLog = Join-Path $LogDir "setup.log"
# Native tools write progress to stderr; with ErrorActionPreference=Stop that
# becomes a terminating NativeCommandError, so relax it around these calls and
# check the exit codes ourselves.
$ErrorActionPreference = "Continue"
& $PythonExe -m pip install -q -r (Join-Path $Root "backend\requirements.txt") 2>&1 | Set-Content -LiteralPath $SetupLog
if ($LASTEXITCODE -ne 0) { Write-Log "[error] pip install failed - see logs\setup.log" }

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "node_modules"))) {
  Write-Log "[setup] installing frontend dependencies"
  Push-Location -LiteralPath $FrontendDir
  try { npm install 2>&1 | Set-Content -LiteralPath $SetupLog } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Log "[error] npm install failed - see logs\setup.log" }
}
$ErrorActionPreference = "Stop"

# --- free the ports from a previous run so a double-click always works ---
foreach ($port in 8765, 6769) {
  $existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($existing) {
    $existing.OwningProcess | Select-Object -Unique | ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Write-Log "[start] freed port $port from a previous instance"
  }
}

if ($Windowed) {
  Write-Host "[start] backend + frontend share this console - Ctrl+C stops both."
  $backend = Start-Cmd ('"' + $BackendBat + '" --reload')
  $frontend = Start-Cmd ('"' + $FrontendBat + '"')
  try {
    Wait-Process -Id $backend.Id, $frontend.Id
  } finally {
    Stop-Process -Id $backend.Id, $frontend.Id -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

# --- hidden mode: no console windows, output to logs/ ---
Write-Log "[start] launching backend + frontend hidden"
Start-HiddenCmd ($BackendBat + '" > "' + (Join-Path $LogDir "backend.log") + '" 2>&1')
Start-HiddenCmd ($FrontendBat + '" > "' + (Join-Path $LogDir "frontend.log") + '" 2>&1')

$backendOk = Wait-AnyPort 8765
# The frontend is reported but not gated: vite sometimes binds well after its
# log says "ready" (IPv6/handle timing), and the browser opening against the
# backend is what matters - the SPA connects to /api on 8765 anyway.
$frontendOk = Wait-AnyPort 6769 20
Write-Log ("[start] backend=" + $backendOk + " frontend=" + $frontendOk)

if ($backendOk) {
  Write-Log "[start] opening the browser"
  try { Start-Process "http://localhost:6769/" } catch {
    Write-Log ("[warn] could not open the browser: " + $_.Exception.Message)
  }
  exit 0
} else {
  Write-Log "[error] backend did not come up - see logs\backend.log"
  try { Start-Process notepad.exe (Join-Path $LogDir "backend.log") } catch { }
  exit 1
}
