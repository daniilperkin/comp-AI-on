# Stops comp[AI]on: frees ports 8765/6769 and kills the recorded launcher pids.
$ErrorActionPreference = "SilentlyContinue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root "logs"
$stopped = 0

foreach ($port in 8765, 6769) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($p in ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
    if ($p) {
      Stop-Process -Id $p -Force
      Write-Host "stopped pid $p (port $port)"
      $stopped++
    }
  }
}

$pidsFile = Join-Path $LogDir "pids.txt"
if (Test-Path -LiteralPath $pidsFile) {
  Get-Content -LiteralPath $pidsFile | ForEach-Object {
    if ($_ -match "^\d+$") { Stop-Process -Id ([int]$_) -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item -LiteralPath $pidsFile -Force -ErrorAction SilentlyContinue
}

if ($stopped -eq 0) {
  Write-Host "comp[AI]on is not running."
} else {
  Write-Host "comp[AI]on stopped."
}
