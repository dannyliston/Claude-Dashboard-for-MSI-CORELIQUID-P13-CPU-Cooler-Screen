# Claude Cooler Dashboard - System Tray Controller
# Provides a tray icon with Start/Stop/Restart/Exit menu
# This is the main entry point for manual launches

param([switch]$AutoStart)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API for hiding Chrome from taskbar
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath = Join-Path $scriptDir "dashboard.ico"

# ---- Helper functions ----

function Start-Dashboard {
    # Start backend if not running
    $existing = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try { $_.CommandLine -match "server\.js" } catch { $false }
    }
    if (-not $existing) {
        Start-Process -FilePath "node" -ArgumentList "server.js" `
            -WorkingDirectory $scriptDir -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }

    # Find 480x480 display
    $coolerDisplay = [System.Windows.Forms.Screen]::AllScreens | Where-Object {
        $_.Bounds.Width -eq 480 -and $_.Bounds.Height -eq 480
    }
    if (-not $coolerDisplay) { return }

    $x = $coolerDisplay.Bounds.X
    $y = $coolerDisplay.Bounds.Y

    # Start Chrome if not running
    $chromeRunning = Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object {
        try { $_.CommandLine -match "localhost:7891" } catch { $false }
    }
    if (-not $chromeRunning) {
        $chromeArgs = "--app=http://localhost:7891 --window-position=$x,$y --window-size=480,480 --disable-infobars --disable-session-crashed-bubble --kiosk"
        Start-Process "chrome" $chromeArgs
        Start-Sleep -Seconds 2
        Hide-ChromeFromTaskbar
    }
}

function Stop-Dashboard {
    # Kill node backend
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -eq "" -or $_.CommandLine -match "server.js"
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    # Kill Chrome kiosk
    Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match "localhost:7891"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Hide-ChromeFromTaskbar {
    Start-Sleep -Seconds 1
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
            # Hide and show to apply the style change
            [Win32]::ShowWindow($hwnd, 0) | Out-Null
            Start-Sleep -Milliseconds 100
            [Win32]::ShowWindow($hwnd, 5) | Out-Null
        }
    }
}

# ---- Tray icon setup ----

$tray = New-Object System.Windows.Forms.NotifyIcon
if (Test-Path $iconPath) {
    $tray.Icon = New-Object System.Drawing.Icon($iconPath)
} else {
    $tray.Icon = [System.Drawing.SystemIcons]::Application
}
$tray.Text = "Claude Dashboard"
$tray.Visible = $true

# Context menu
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$startItem = $menu.Items.Add("Start Dashboard")
$startItem.add_Click({
    Start-Dashboard
    $tray.ShowBalloonTip(2000, "Claude Dashboard", "Dashboard started", [System.Windows.Forms.ToolTipIcon]::Info)
})

$stopItem = $menu.Items.Add("Stop Dashboard")
$stopItem.add_Click({
    Stop-Dashboard
    $tray.ShowBalloonTip(2000, "Claude Dashboard", "Dashboard stopped", [System.Windows.Forms.ToolTipIcon]::Info)
})

$restartItem = $menu.Items.Add("Restart Dashboard")
$restartItem.add_Click({
    Stop-Dashboard
    Start-Sleep -Seconds 2
    Start-Dashboard
    $tray.ShowBalloonTip(2000, "Claude Dashboard", "Dashboard restarted", [System.Windows.Forms.ToolTipIcon]::Info)
})

$menu.Items.Add("-") | Out-Null  # Separator

$exitItem = $menu.Items.Add("Exit")
$exitItem.add_Click({
    Stop-Dashboard
    $tray.Visible = $false
    $tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu

# Double-click tray icon to start/restart
$tray.add_DoubleClick({
    Start-Dashboard
})

# Auto-start if requested
if ($AutoStart) {
    Start-Dashboard
}

# Run the message loop (keeps tray alive)
[System.Windows.Forms.Application]::Run()
