# Claude Cooler Dashboard — Startup Script
# Designed to run at Windows login via Task Scheduler
# Starts the backend and Chrome kiosk if not already running

Add-Type -AssemblyName System.Windows.Forms

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if backend is already running
$existing = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -match "server\.js" } catch { $false }
}

if ($existing) {
    Write-Host "Dashboard backend already running (PID: $($existing.Id))"
} else {
    $backend = Start-Process -FilePath "node" -ArgumentList "server.js" `
        -WorkingDirectory $scriptDir -PassThru -WindowStyle Hidden
    Write-Host "Backend started (PID: $($backend.Id))"
    Start-Sleep -Seconds 2
}

# Find the 480x480 display
$coolerDisplay = [System.Windows.Forms.Screen]::AllScreens | Where-Object {
    $_.Bounds.Width -eq 480 -and $_.Bounds.Height -eq 480
}

if (-not $coolerDisplay) {
    Write-Host "No 480x480 cooler display found — backend running, Chrome skipped"
    exit 0
}

$x = $coolerDisplay.Bounds.X
$y = $coolerDisplay.Bounds.Y

# Check if Chrome kiosk is already on the cooler display
$chromeRunning = Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -match "localhost:7891" } catch { $false }
}

if (-not $chromeRunning) {
    $chromeArgs = "--app=http://localhost:7891 --window-position=$x,$y --window-size=480,480 --disable-infobars --disable-session-crashed-bubble --kiosk"
    Start-Process "chrome" $chromeArgs
    Write-Host "Chrome launched on cooler display at ($x, $y)"
} else {
    Write-Host "Chrome already running on cooler display"
}
