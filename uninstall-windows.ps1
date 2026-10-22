$target = Join-Path $env:LOCALAPPDATA '180 Hitters'
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) '180 Hitters.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) '180 Hitters.lnk') -Force -ErrorAction SilentlyContinue
Write-Host "Snelkoppelingen verwijderd. Sluit de server; verwijder daarna desgewenst $target."
