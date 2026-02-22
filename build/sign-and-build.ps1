# Tauri signed build script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\sign-and-build.ps1

param(
    [SecureString]$Password = $null
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# --- Security Module Import ---
try {
    Import-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
} catch {
    Write-Host "[*] Could not load security module - continuing anyway" -ForegroundColor Yellow
}

Write-Host "[*] Starting Tauri signed build..." -ForegroundColor Cyan
$rootDir = Split-Path -Parent $PSScriptRoot

# --- Key Setup ---
$keyPaths = @(
    (Join-Path $PSScriptRoot "..\~\TAURI_KEY_PASSWORD.sh"),
    (Join-Path $env:USERPROFILE "TAURI_KEY_PASSWORD.sh"),
    (Join-Path $env:USERPROFILE ".ssh\TAURI_KEY_PASSWORD.sh")
)
$keyPath = $null
foreach ($path in $keyPaths) { if (Test-Path $path) { $keyPath = $path; break } }
if (-not $keyPath) { Write-Host "[!] Error: Private key not found" -ForegroundColor Red; exit 1 }

# --- Password Setup ---
if (-not $Password) {
    $userPassword = [Environment]::GetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD')
    if (-not $userPassword) { $userPassword = [Environment]::GetEnvironmentVariable('TAURI_SIGNING_PASSWORD_OVERRIDE', 'User') }

    if ($userPassword) {
        $plainPassword = $userPassword
        Write-Host "[+] Using password from environment variable" -ForegroundColor Green
    } else {
        Write-Host "[?] Enter private key password:" -ForegroundColor Yellow
        $securePassword = Read-Host -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
$keyContent = Get-Content $keyPath -Raw
$env:TAURI_SIGNING_PRIVATE_KEY = $keyContent
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $plainPassword
$plainPassword = $null # Cleanup

# --- Build Cleanup & Execution ---
Write-Host "[*] Cleaning up..." -ForegroundColor Cyan
if (Test-Path "src-tauri\target\release") { Remove-Item "src-tauri\target\release" -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "[*] Building..." -ForegroundColor Cyan
npm run tauri:build
if ($LASTEXITCODE -ne 0) { Write-Host "[!] Build failed" -ForegroundColor Red; exit 1 }

# --- Setup Release Directory ---
$releaseDir = Join-Path $rootDir "release"
$bundleDir = Join-Path $rootDir "src-tauri\target\release\bundle"
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }

# Get Version info
$tauriConf = Get-Content (Join-Path $rootDir "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$version = $tauriConf.version
$exeNewName = "GidoSetup-x64-$version.exe"

# --- Process Installers (Rename THEN Sign) ---
$exeFile = Get-ChildItem $bundleDir -Filter "*-setup.exe" -Recurse | Select-Object -First 1

if ($exeFile) {
    Write-Host "[*] Processing EXE..." -ForegroundColor Cyan

    # 1. Copy & Rename EXE to release folder FIRST
    $exeNewPath = Join-Path $releaseDir $exeNewName
    Copy-Item $exeFile.FullName -Destination $exeNewPath -Force
    Write-Host "[+] Copied and renamed to: $exeNewName" -ForegroundColor Green

    # 2. Sign the RENAMED file (So internal filename matches)
    Write-Host "[*] Signing the renamed file..." -ForegroundColor Cyan
    npx @tauri-apps/cli signer sign "$exeNewPath" 2>&1 | Out-Null

    # 3. Move/Rename the generated signature
    # Tauri signer generates <filename>.sig in the same folder
    $generatedSigPath = "$exeNewPath.sig"

    if (Test-Path $generatedSigPath) {
        Write-Host "[+] Signature created matching new filename" -ForegroundColor Green
    } else {
        Write-Host "[!] Warning: Signature file creation failed" -ForegroundColor Yellow
    }
}

# --- Cleanup Old Files ---
Get-ChildItem -Path "$releaseDir\*.exe" | Where-Object { -not ($_.Name -like "GidoSetup-*") } | Remove-Item -Force
Get-ChildItem -Path "$releaseDir\*.sig" | Where-Object { -not ($_.Name -like "GidoSetup-*") } | Remove-Item -Force

Write-Host "[+] Signed build completed!" -ForegroundColor Green
