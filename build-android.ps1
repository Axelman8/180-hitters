$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Android = Join-Path $Root 'android'
$Jdk = Get-ChildItem (Join-Path $Root '.tools\jdk17') -Directory | Select-Object -First 1 -ExpandProperty FullName
$Sdk = Join-Path $Root '.tools\android-sdk'
$GradleLauncher = Join-Path $Root '.tools\gradle\gradle-8.9\lib\gradle-launcher-8.9.jar'
if (-not (Test-Path (Join-Path $Jdk 'bin\java.exe'))) { throw 'Draagbare JDK ontbreekt.' }
if (-not (Test-Path (Join-Path $Sdk 'platforms\android-35\android.jar'))) { throw 'Android SDK 35 ontbreekt.' }
$env:JAVA_HOME = $Jdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_HOME = $Sdk
Push-Location $Android
try { & (Join-Path $Jdk 'bin\java.exe') '-classpath' $GradleLauncher 'org.gradle.launcher.GradleMain' '--no-daemon' 'assembleRelease'; if ($LASTEXITCODE) { throw "Gradle stopte met code $LASTEXITCODE" } }
finally { Pop-Location }
$Source = Join-Path $Android 'app\build\outputs\apk\release\app-release.apk'
$TargetDir = Join-Path $Root 'dist\downloads'
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -LiteralPath $Source -Destination (Join-Path $TargetDir '180-Hitters.apk') -Force
Write-Host "APK gereed: $TargetDir\180-Hitters.apk"
