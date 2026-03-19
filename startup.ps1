# Claude Cooler Dashboard - Startup Script
# Designed to run at Windows login via Task Scheduler
# Launches the tray controller which handles backend + Chrome

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Transcript -Path "$scriptDir\startup.log" -Force

try {

# Check if tray is already running
$trayRunning = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -match "tray\.ps1" } catch { $false }
}

if ($trayRunning) {
    Write-Host "Tray controller already running - skipping"
    exit 0
}

# Launch tray controller with auto-start flag (hidden window)
$trayScript = Join-Path $scriptDir "tray.ps1"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$trayScript`" -AutoStart" `
    -WindowStyle Hidden

Write-Host "Tray controller launched with auto-start"

} catch {
    $errMsg = $_.Exception.Message
    Write-Host "ERROR: $errMsg"
    exit 1
} finally {
    Stop-Transcript
}
