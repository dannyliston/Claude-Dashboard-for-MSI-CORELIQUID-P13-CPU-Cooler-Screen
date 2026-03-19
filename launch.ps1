# Claude Cooler Dashboard - Launch Script
# Detects the 480x480 cooler display and opens Chrome in kiosk mode
# For everyday use, prefer tray.ps1 which provides a system tray icon

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

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

# Hide Chrome from taskbar
Start-Sleep -Seconds 2
$chromeProcs = Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -match "localhost:7891" } catch { $false }
}
foreach ($proc in $chromeProcs) {
    $hwnd = $proc.MainWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) {
        $GWL_EXSTYLE = -20
        $WS_EX_TOOLWINDOW = 0x80
        $style = [Win32]::GetWindowLong($hwnd, $GWL_EXSTYLE)
        [Win32]::SetWindowLong($hwnd, $GWL_EXSTYLE, $style -bor $WS_EX_TOOLWINDOW) | Out-Null
        [Win32]::ShowWindow($hwnd, 0) | Out-Null
        Start-Sleep -Milliseconds 100
        [Win32]::ShowWindow($hwnd, 5) | Out-Null
    }
}

Write-Host "Dashboard launched on cooler display (hidden from taskbar)"
Write-Host "Run stop.ps1 to shut down, or use tray.ps1 for tray control"
