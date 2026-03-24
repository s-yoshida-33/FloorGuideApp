# Map image S3 upload script for Gido
# Usage: powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada"
#
# For each hostname directory under medias/maps/{MallId}/{hostname}/:
#   - Reads the .webp map file(s)
#   - Uploads with timestamp: {floor}F-map-{timestamp}.webp
#   - Generates latest.json: { "file": "...", "updated_at": "..." }
#   - Uploads to S3: s3://tti-distribution/public/gido/medias/maps/{MallId}/{hostname}/
#
# Local source layout:
#   medias/maps/{MallId}/{hostname}/{floor}F-map.webp
#
# S3 output layout:
#   s3://tti-distribution/public/gido/medias/maps/{MallId}/{hostname}/{floor}F-map-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/maps/{MallId}/{hostname}/latest.json

param(
    [string]$MallId = ""
)

chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (e.g. sakaikitahanada, suzaka): " -NoNewline
    $MallId = Read-Host
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: Mall ID is required." -ForegroundColor Red
        exit 1
    }
}

$rootDir    = Split-Path -Parent $PSScriptRoot
$mediasRoot = Join-Path $rootDir "medias"
$mapsDir    = Join-Path $mediasRoot "maps\$MallId"
$today      = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"

if (-not (Test-Path $mapsDir)) {
    Write-Host "Error: Maps directory not found: $mapsDir" -ForegroundColor Red
    exit 1
}

$hostnameDirs = Get-ChildItem -Path $mapsDir -Directory -ErrorAction SilentlyContinue

if ($hostnameDirs.Count -eq 0) {
    Write-Host "No hostname directories found under: $mapsDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Processing maps for mall: $MallId" -ForegroundColor Cyan
Write-Host "Found $($hostnameDirs.Count) hostname dir(s): $($hostnameDirs.Name -join ', ')" -ForegroundColor Green

foreach ($hostnameDir in $hostnameDirs) {
    $hn     = $hostnameDir.Name
    $srcDir = $hostnameDir.FullName
    $s3Base = "s3://tti-distribution/public/gido/medias/maps/$MallId/$hn"

    Write-Host "`n[HOSTNAME: $hn]" -ForegroundColor Magenta

    # Find .webp files (e.g. 1F-map.webp, 2F-map.webp)
    $webpFiles = Get-ChildItem -Path $srcDir -Filter "*F-map.webp" -File -ErrorAction SilentlyContinue

    if ($webpFiles.Count -eq 0) {
        Write-Host "  No *F-map.webp files found. Skipping." -ForegroundColor Yellow
        continue
    }

    # Upload each .webp file with a timestamp
    foreach ($webpFile in $webpFiles) {
        # Derive base name (e.g. "1F-map" from "1F-map.webp")
        $baseName    = [System.IO.Path]::GetFileNameWithoutExtension($webpFile.Name)
        $uploadName  = "$baseName-$today.webp"
        $updatedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

        Write-Host "  File: $($webpFile.Name) -> $uploadName" -ForegroundColor Green

        if (Get-Command aws -ErrorAction SilentlyContinue) {
            # Remove old timestamped files from S3 (keep latest.json)
            Write-Host "  Cleaning old timestamped files from S3..." -ForegroundColor Cyan
            aws s3 rm "$s3Base/" --recursive --exclude "latest.json" 2>&1 | Out-Null

            # Upload new file
            try {
                aws s3 cp $webpFile.FullName "$s3Base/$uploadName" --content-type "image/webp"
                Write-Host "  Uploaded: $uploadName" -ForegroundColor Green
            } catch {
                Write-Host "  Upload failed: $_" -ForegroundColor Red
                Write-Host "  Please upload manually:" -ForegroundColor Yellow
                Write-Host "    aws s3 cp `"$($webpFile.FullName)`" `"$s3Base/$uploadName`" --content-type image/webp" -ForegroundColor Gray
                continue
            }

            # Generate and upload latest.json
            $latestJson = @{ file = $uploadName; updated_at = $updatedAt } | ConvertTo-Json -Compress
            $tmpJson    = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllText($tmpJson, $latestJson, [System.Text.Encoding]::UTF8)

            try {
                aws s3 cp $tmpJson "$s3Base/latest.json" `
                    --content-type "application/json" `
                    --cache-control "no-cache, no-store"
                Write-Host "  Uploaded: latest.json (file=$uploadName, updated_at=$updatedAt)" -ForegroundColor Green
            } catch {
                Write-Host "  Failed to upload latest.json: $_" -ForegroundColor Red
            } finally {
                Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Host "  [INFO] AWS CLI not found. Upload manually:" -ForegroundColor Yellow
            Write-Host "    aws s3 rm `"$s3Base/`" --recursive --exclude latest.json" -ForegroundColor Gray
            Write-Host "    aws s3 cp `"$($webpFile.FullName)`" `"$s3Base/$uploadName`" --content-type image/webp" -ForegroundColor Gray
            Write-Host "    # Then upload latest.json: { `"file`": `"$uploadName`", `"updated_at`": `"$updatedAt`" }" -ForegroundColor Gray
        }
    }

    Write-Host "  Done: $hn" -ForegroundColor Green
}

Write-Host "`nDone!" -ForegroundColor Green
