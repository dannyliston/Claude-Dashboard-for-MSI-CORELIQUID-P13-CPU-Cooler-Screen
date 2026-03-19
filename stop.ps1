# Claude Cooler Dashboard — Stop Script
# Kills the backend and the kiosk Chrome window

# Kill node server
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -eq "" -or $_.CommandLine -match "server.js"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill the kiosk Chrome window (the one pointing at localhost:7891)
# This targets Chrome processes with our specific URL
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "localhost:7891"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Dashboard stopped"
