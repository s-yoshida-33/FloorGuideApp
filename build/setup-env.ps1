# Tauri Build Environment Setup Script
# Sets password in environment variable to avoid repeated prompts

param(
    [SecureString]$Password = $null,
    [switch]$ClearPassword = $false,
    [switch]$ShowCurrent = $false
)

$envVarName = "TAURI_SIGNING_PASSWORD_OVERRIDE"

Write-Host "[*] Tauri Build Environment Setup" -ForegroundColor Cyan
Write-Host ""

if ($ShowCurrent) {
    if ([Environment]::GetEnvironmentVariable($envVarName, "User")) {
        Write-Host "[+] Environment variable $envVarName is set" -ForegroundColor Green
        Write-Host "[*] Active in current PowerShell session" -ForegroundColor Cyan
    } else {
        Write-Host "[-] Environment variable $envVarName is not set" -ForegroundColor Yellow
    }
    exit 0
}

if ($ClearPassword) {
    Write-Host "[*] Clearing environment variable..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable($envVarName, "", "User")
    Write-Host "[+] Environment variable $envVarName cleared" -ForegroundColor Green
    Write-Host "[!] Changes will take effect in new PowerShell windows" -ForegroundColor Yellow
    exit 0
}

# Password input
if ($null -eq $Password) {
    Write-Host "[?] Enter password (leave blank to cancel):" -ForegroundColor Yellow
    $Password = Read-Host -AsSecureString

    if ($Password.Length -eq 0) {
        Write-Host "[-] Cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Convert SecureString to plain text only for environment variable storage
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

# Set environment variable at user level
Write-Host "[*] Setting environment variable..." -ForegroundColor Cyan
[Environment]::SetEnvironmentVariable($envVarName, $plainPassword, "User")

# Clear the variable from memory
$plainPassword = ""

Write-Host ""
Write-Host "[+] Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "[!] IMPORTANT: Close this PowerShell window and open a NEW one" -ForegroundColor Yellow
Write-Host "    The environment variable becomes active in new windows." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next step: Run in new PowerShell window" -ForegroundColor Yellow
Write-Host "  npm run tauri:release" -ForegroundColor Cyan
Write-Host ""
Write-Host "To clear password:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ClearPassword" -ForegroundColor Cyan
Write-Host ""
Write-Host "To check current setting:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ShowCurrent" -ForegroundColor Cyan
Write-Host ""
