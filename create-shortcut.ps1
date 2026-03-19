# Claude Cooler Dashboard - Create Desktop Shortcut
# Run once to create a shortcut on your desktop

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$trayScript = Join-Path $scriptDir "tray.ps1"
$iconPath = Join-Path $scriptDir "dashboard.ico"
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Claude Dashboard.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$trayScript`" -AutoStart"
$shortcut.WorkingDirectory = $scriptDir
$shortcut.Description = "Claude Cooler Dashboard - System Tray Controller"
$shortcut.WindowStyle = 7  # Minimized

if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()
Write-Host "Desktop shortcut created at: $shortcutPath"
Write-Host "Double-click it to launch the dashboard with system tray control."
