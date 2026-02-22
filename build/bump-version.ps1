# Version bump script for Gido
# Usage: powershell -ExecutionPolicy Bypass -File .\build\bump-version.ps1

[System.Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseDeclaredVarsMoreThanAssignments', '')]
param()

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Stop on error
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "   Gido Version Bump Script"              -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

# Get root directory
$rootDir = Split-Path -Parent $PSScriptRoot
Write-Host "[*] Root directory: $rootDir" -ForegroundColor Cyan

# File paths
$packageJsonPath = Join-Path $rootDir "package.json"
$tauriConfPath = Join-Path $rootDir "src-tauri\tauri.conf.json"
$cargoTomlPath = Join-Path $rootDir "src-tauri\Cargo.toml"

# Check if files exist
if (-not (Test-Path $packageJsonPath)) {
    Write-Host "[!] Error: package.json not found at $packageJsonPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $tauriConfPath)) {
    Write-Host "[!] Error: tauri.conf.json not found at $tauriConfPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $cargoTomlPath)) {
    Write-Host "[!] Error: Cargo.toml not found at $cargoTomlPath" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Found package.json" -ForegroundColor Green
Write-Host "[+] Found tauri.conf.json" -ForegroundColor Green
Write-Host "[+] Found Cargo.toml" -ForegroundColor Green
Write-Host ""

# Get current versions
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "[*] Current version in package.json: $currentVersion" -ForegroundColor Yellow

# Get new version from user
$newVersion = Read-Host 'Enter new version (format: 1.5.1)'

if (-not $newVersion) {
    Write-Host "[!] Error: Version cannot be empty" -ForegroundColor Red
    exit 1
}

# Validate version format (basic)
if ($newVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "[!] Error: Invalid version format. Use X.Y.Z" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[*] Updating version from $currentVersion to $newVersion" -ForegroundColor Cyan
Write-Host ""

# Update package.json
Write-Host "[*] Updating package.json..." -ForegroundColor Cyan
try {
    $packageContent = Get-Content $packageJsonPath -Raw -Encoding UTF8
    # Replace only the version line
    $packageContent = $packageContent -replace '("version"\s*:\s*")[^"]*"', "`${1}$newVersion`""
    # Write with UTF-8 without BOM
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($packageContent)
    [System.IO.File]::WriteAllBytes($packageJsonPath, $bytes)
    Write-Host "[+] package.json updated successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] Error updating package.json: $_" -ForegroundColor Red
    exit 1
}

# Update tauri.conf.json
Write-Host "[*] Updating tauri.conf.json..." -ForegroundColor Cyan
try {
    $tauriContent = Get-Content $tauriConfPath -Raw -Encoding UTF8
    # Replace only the version line
    $tauriContent = $tauriContent -replace '("version"\s*:\s*")[^"]*"', "`${1}$newVersion`""
    # Write with UTF-8 without BOM
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($tauriContent)
    [System.IO.File]::WriteAllBytes($tauriConfPath, $bytes)
    Write-Host "[+] tauri.conf.json updated successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] Error updating tauri.conf.json: $_" -ForegroundColor Red
    exit 1
}

# Update Cargo.toml
Write-Host "[*] Updating Cargo.toml..." -ForegroundColor Cyan
try {
    $cargoContent = Get-Content $cargoTomlPath -Raw -Encoding UTF8
    # Only replace the version in [package] section (first occurrence)
    $cargoContent = $cargoContent -replace '(\[package\][\s\S]*?version = ")[^"]*"', "`${1}$newVersion`""
    # Write with UTF-8 without BOM
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cargoContent)
    [System.IO.File]::WriteAllBytes($cargoTomlPath, $bytes)
    Write-Host "[+] Cargo.toml updated successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] Error updating Cargo.toml: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================"  -ForegroundColor Green
Write-Host "   Version Update Complete!"             -ForegroundColor Green
Write-Host "========================================"  -ForegroundColor Green
Write-Host ""

Write-Host "[+] Files updated:" -ForegroundColor Green
Write-Host "   - package.json" -ForegroundColor Green
Write-Host "   - tauri.conf.json" -ForegroundColor Green
Write-Host "   - Cargo.toml" -ForegroundColor Green
Write-Host ""

Write-Host "[*] Next steps:" -ForegroundColor Cyan
Write-Host "   1. Run: npm install" -ForegroundColor Cyan
Write-Host "   2. Review changes: git diff" -ForegroundColor Cyan
Write-Host "   3. Commit version change" -ForegroundColor Cyan
Write-Host "   4. Tag release: git tag v$newVersion" -ForegroundColor Cyan
Write-Host "   5. Push changes" -ForegroundColor Cyan
Write-Host ""

Write-Host "[+] Script completed successfully" -ForegroundColor Green
