$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $env:LOCALAPPDATA '180 Hitters'
$python = Get-Command pythonw.exe -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python.exe -ErrorAction SilentlyContinue }
if (-not $python) { throw 'Installeer eerst Python 3 vanaf python.org en vink Add Python to PATH aan.' }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $source 'dist') $target -Recurse -Force
Copy-Item (Join-Path $source 'server.py') $target -Force
Copy-Item (Join-Path $source 'autodarts_bridge.py'), (Join-Path $source 'camera_research.py') $target -Force
if (Test-Path (Join-Path $source '.version')) { Copy-Item (Join-Path $source '.version') $target -Force }
$start = Join-Path $target 'Start 180 Hitters.cmd'
@"
@echo off
start "180 Hitters server" /min "$($python.Source)" "$target\server.py"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8765
"@ | Set-Content -Encoding ASCII $start
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut((Join-Path $desktop '180 Hitters.lnk'))
$shortcut.TargetPath = $start
$shortcut.WorkingDirectory = $target
$shortcut.IconLocation = (Join-Path $target 'dist\avatar.jpg')
$shortcut.Save()
$startup = [Environment]::GetFolderPath('Startup')
Copy-Item (Join-Path $desktop '180 Hitters.lnk') (Join-Path $startup '180 Hitters.lnk') -Force
Start-Process $start
Write-Host '180 Hitters is geïnstalleerd en start voortaan met Windows.'
Write-Host 'Sta Python toe in Windows Firewall als andere telefoons via hetzelfde wifi-netwerk moeten verbinden.'
