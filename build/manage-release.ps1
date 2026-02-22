param(
    [string]$Version = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "[*] Release file management script starting..." -ForegroundColor Cyan

# --- Directory Setup ---
$rootDir = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $rootDir "release"
$srcTauriDir = Join-Path $rootDir "src-tauri"
$tauriConfPath = Join-Path $srcTauriDir "tauri.conf.json"

# --- 1. Get Version Information ---
if (Test-Path $tauriConfPath) {
    try {
        $tauriConfContent = [System.IO.File]::ReadAllText($tauriConfPath, [System.Text.Encoding]::UTF8)
        $tauriConf = $tauriConfContent | ConvertFrom-Json
        $version = $tauriConf.version
        Write-Host "[*] Detected Version: $version" -ForegroundColor Cyan
    } catch {
        Write-Host "[!] Error reading config: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[!] Error: tauri.conf.json not found." -ForegroundColor Red
    exit 1
}

# --- 2. Check Release Directory ---
if (-not (Test-Path $releaseDir)) {
    Write-Host "[!] Error: Release directory not found." -ForegroundColor Red
    exit 1
}

# --- 3. Find Installer (.exe) ---
$targetExeName = "GidoSetup-x64-${version}.exe"
$exeFile = Get-ChildItem $releaseDir -Filter $targetExeName | Select-Object -First 1

if (-not $exeFile) {
    Write-Host "[!] Error: Installer ($targetExeName) not found." -ForegroundColor Red
    exit 1
}

# --- 4. Find Signature File (.sig) ---
$targetSigName = "${targetExeName}.sig"
$sigFile = Get-ChildItem $releaseDir -Filter $targetSigName | Select-Object -First 1

if (-not $sigFile) {
    # Fallback search (before rename or using alternative pattern)
    $sigFile = Get-ChildItem $releaseDir -Filter "*-setup.exe.sig" | Select-Object -First 1
}

if (-not $sigFile) {
    Write-Host "[!] Error: Signature file not found." -ForegroundColor Red
    exit 1
}

# --- 5. Read and Encode Signature Content ---
try {
    $rawContent = [System.IO.File]::ReadAllText($sigFile.FullName, [System.Text.Encoding]::UTF8).Trim()

    # Ensure we have the raw minisign signature text
    if (-not ($rawContent -match "^untrusted comment:")) {
        Write-Host "[*] Signature appears to be Base64 encoded. Decoding to raw text..." -ForegroundColor Yellow
        $bytes = [System.Convert]::FromBase64String($rawContent)
        $signatureContent = [System.Text.Encoding]::UTF8.GetString($bytes)
    } else {
        $signatureContent = $rawContent
    }

    # Normalize Windows line endings to Unix LF
    $signatureContent = $signatureContent -replace "`r`n", "`n"
    $signatureContent = $signatureContent -replace "`r", "`n"
    $signatureContent = $signatureContent.Trim()

    # CRITICAL: tauri-plugin-updater's verify_signature() calls base64_to_string()
    # on BOTH pubkey AND signature before passing to minisign-verify.
    # The signature in latest.json must be Base64-encoded (matching pubkey format).
    $signatureBytes = [System.Text.Encoding]::UTF8.GetBytes($signatureContent)
    $signatureBase64 = [System.Convert]::ToBase64String($signatureBytes)

    Write-Host "[*] Signature Base64-encoded for Tauri updater (${signatureBase64.Length} chars)" -ForegroundColor Cyan
} catch {
    Write-Host "[!] Error processing signature: $_" -ForegroundColor Red
    exit 1
}

# --- 6. Construct latest.json ---
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$baseUrl = "https://github.com/s-yoshida-33/Gido/releases/download/v${version}"

$jsonObj = @{
    version = $version
    notes = "Update for version ${version}"
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $signatureBase64
            url = "${baseUrl}/$($exeFile.Name)"
        }
    }
}

# --- 7. Write JSON to file ---
try {
    $jsonContent = $jsonObj | ConvertTo-Json -Depth 10
    $jsonContent = $jsonContent -replace '    ', '  '

    $latestJsonPath = Join-Path $releaseDir "latest.json"
    [System.IO.File]::WriteAllText($latestJsonPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))

    Write-Host "[+] Successfully created latest.json" -ForegroundColor Green

    # Remove latest.yml if it exists (to prevent confusion)
    $ymlPath = Join-Path $releaseDir "latest.yml"
    if (Test-Path $ymlPath) {
        Remove-Item $ymlPath -Force
        Write-Host "[*] Removed legacy latest.yml" -ForegroundColor Gray
    }

} catch {
    Write-Host "[!] Error writing JSON: $_" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Release preparation completed!" -ForegroundColor Green
