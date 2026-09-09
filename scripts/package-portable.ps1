param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SkipBuild) { npm run tauri build }

$binary = Join-Path $projectRoot 'src-tauri\target\release\prompt-saver.exe'
if (-not (Test-Path -LiteralPath $binary)) { throw "Не знайдено $binary. Спочатку виконайте npm run tauri build." }
$output = Join-Path $projectRoot 'dist\Prompt-Saver-portable-x64'
New-Item -ItemType Directory -Force -Path $output | Out-Null
Copy-Item -LiteralPath $binary -Destination (Join-Path $output 'Prompt Saver.exe') -Force
New-Item -ItemType File -Force -Path (Join-Path $output 'portable.marker') | Out-Null
Compress-Archive -Path $output -DestinationPath (Join-Path $projectRoot 'dist\Prompt-Saver-portable-x64.zip') -Force
Write-Host "Portable archive: dist\Prompt-Saver-portable-x64.zip"
