# Claude Cooler Dashboard — Launch Script
# Detects the 480x480 cooler display and opens Chrome in kiosk mode

Add-Type -AssemblyName System.Windows.Forms

# Find the 480x480 display
$coolerDisplay = [System.Windows.Forms.Screen]::AllScreens | Where-Object {
    $_.Bounds.Width -eq 480 -and $_.Bounds.Height -eq 480
}

if (-not $coolerDisplay) {
    Write-Host "ERROR: No 480x480 display found." -ForegroundColor Red
    Write-Host "Available displays:"
    [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
        Write-Host "  $($_.DeviceName): $($_.Bounds.Width)x$($_.Bounds.Height) at ($($_.Bounds.X), $($_.Bounds.Y))"
    }
    exit 1
}

$x = $coolerDisplay.Bounds.X
$y = $coolerDisplay.Bounds.Y
Write-Host "Found cooler display at position ($x, $y)"

# Start the Node.js backend
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Start-Process -FilePath "node" -ArgumentList "server.js" `
    -WorkingDirectory $scriptDir -PassThru -WindowStyle Hidden

Write-Host "Backend started (PID: $($backend.Id))"

# Wait for server to be ready
Start-Sleep -Seconds 2

# Launch Chrome in kiosk/app mode on the cooler display
$chromeArgs = "--app=http://localhost:7891 --window-position=$x,$y --window-size=480,480 --disable-infobars --disable-session-crashed-bubble --kiosk"
Start-Process "chrome" $chromeArgs

Write-Host "Dashboard launched on cooler display"
Write-Host "Run stop.ps1 to shut down"
