# Map / open-time / banner image S3 upload script for Gido
# Usage:
#   # Upload maps (default)
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada"
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada" -MediaType maps
#
#   # Upload open-time image
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada" -MediaType open-times
#
#   # Upload banner images (layout-specific, e.g. sakaikitahanada-v)
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada-v" -MediaType banners
#
# --- maps ---
# For each hostname directory under medias/{MallId}/maps/{hostname}/:
#   - Reads the .webp map file(s)
#   - Uploads with timestamp: {floor}F-map-{timestamp}.webp
#   - Generates latest.json: { "file": "...", "updated_at": "..." }
#   - Uploads to S3: s3://tti-distribution/public/gido/medias/{MallId}/maps/{hostname}/
#
# Local source layout:
#   medias/{MallId}/maps/{hostname}/{floor}F-map.webp
#
# S3 output layout:
#   s3://tti-distribution/public/gido/medias/{MallId}/maps/{hostname}/{floor}F-map-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/{MallId}/maps/{hostname}/latest.json
#
# --- open-times ---
# Reads medias/{MallId}/open-times/open-time.webp
#   - Uploads with timestamp: open-time-{timestamp}.webp
#   - Generates latest.json: { "file": "...", "updated_at": "..." }
#   - Uploads to S3: s3://tti-distribution/public/gido/medias/{MallId}/open-times/
#
# Local source layout:
#   medias/{MallId}/open-times/open-time.webp
#
# S3 output layout:
#   s3://tti-distribution/public/gido/medias/{MallId}/open-times/open-time-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/{MallId}/open-times/latest.json
#
# --- banners ---
# For each hostname directory under medias/{MallId}/banners/{hostname}/:
#   - Reads banner-0.webp, banner-1.webp, ... (any number of banners)
#   - Uploads with timestamp: banner-0-{timestamp}.webp, banner-1-{timestamp}.webp, ...
#   - Generates latest.json: { "files": [...], "updated_at": "..." }
#   - Uploads to S3: s3://tti-distribution/public/gido/medias/{MallId}/banners/{hostname}/
#
# Local source layout:
#   medias/{MallId}/banners/{hostname}/banner-0.webp
#   medias/{MallId}/banners/{hostname}/banner-1.webp
#   ...
#
# S3 output layout:
#   s3://tti-distribution/public/gido/medias/{MallId}/banners/{hostname}/banner-0-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/{MallId}/banners/{hostname}/banner-1-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/{MallId}/banners/{hostname}/latest.json

param(
    [string]$MallId    = "",
    [string]$MediaType = ""
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

# Require MediaType
$validMediaTypes = @("maps", "open-times", "banners", "all")
if ([string]::IsNullOrWhiteSpace($MediaType) -or $MediaType -notin $validMediaTypes) {
    Write-Host "Media type? [maps / open-times / banners / all] (default: maps): " -NoNewline
    $input = Read-Host
    if ([string]::IsNullOrWhiteSpace($input)) {
        $MediaType = "maps"
    } elseif ($input -in $validMediaTypes) {
        $MediaType = $input
    } else {
        Write-Host "Error: Invalid media type '$input'. Choose from: maps, open-times, banners, all." -ForegroundColor Red
        exit 1
    }
}

$rootDir    = Split-Path -Parent $PSScriptRoot
$mediasRoot = Join-Path $rootDir "medias"
$today      = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"

# ---------------------------------------------------------------------------
# Helper: upload a single .webp + latest.json to an S3 prefix
# ---------------------------------------------------------------------------
function Upload-WebpToS3 {
    param(
        [string]$LocalFile,
        [string]$UploadName,   # e.g. "2F-map-2026-03-24-14-00-00.webp"
        [string]$S3Base,
        [string]$UpdatedAt,
        [string]$BaseName      # e.g. "2F-map"  (used for per-floor cleanup and latest.json name)
    )

    $latestJsonName = "latest.json"

    if (Get-Command aws -ErrorAction SilentlyContinue) {
        # Remove only old timestamped files for THIS floor (keep other floors and latest.json)
        Write-Host "  Cleaning old $BaseName-*.webp from S3..." -ForegroundColor Cyan
        aws s3 rm "$S3Base/" --recursive --exclude "*" --include "$BaseName-*.webp" 2>&1 | Out-Null

        # Upload new file
        try {
            aws s3 cp $LocalFile "$S3Base/$UploadName" --content-type "image/webp"
            Write-Host "  Uploaded: $UploadName" -ForegroundColor Green
        } catch {
            Write-Host "  Upload failed: $_" -ForegroundColor Red
            Write-Host "  Please upload manually:" -ForegroundColor Yellow
            Write-Host "    aws s3 cp `"$LocalFile`" `"$S3Base/$UploadName`" --content-type image/webp" -ForegroundColor Gray
            return
        }

        # Generate and upload latest.json
        $latestJson = @{ file = $UploadName; updated_at = $UpdatedAt } | ConvertTo-Json -Compress
        $tmpJson    = [System.IO.Path]::GetTempFileName()
        [System.IO.File]::WriteAllText($tmpJson, $latestJson, [System.Text.Encoding]::UTF8)

        try {
            aws s3 cp $tmpJson "$S3Base/$latestJsonName" `
                --content-type "application/json" `
                --cache-control "no-cache, no-store"
            Write-Host "  Uploaded: $latestJsonName (file=$UploadName, updated_at=$UpdatedAt)" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to upload $latestJsonName`: $_" -ForegroundColor Red
        } finally {
            Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  [INFO] AWS CLI not found. Upload manually:" -ForegroundColor Yellow
        Write-Host "    aws s3 rm `"$S3Base/`" --recursive --exclude `"*`" --include `"$BaseName-*.webp`"" -ForegroundColor Gray
        Write-Host "    aws s3 cp `"$LocalFile`" `"$S3Base/$UploadName`" --content-type image/webp" -ForegroundColor Gray
        Write-Host "    # Then upload $latestJsonName`: { `"file`": `"$UploadName`", `"updated_at`": `"$UpdatedAt`" }" -ForegroundColor Gray
    }
}

# ---------------------------------------------------------------------------
# maps
# ---------------------------------------------------------------------------
if ($MediaType -eq "maps" -or $MediaType -eq "all") {
    $mapsDir = Join-Path $mediasRoot "$MallId\maps"

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
        $s3Base = "s3://tti-distribution/public/gido/medias/$MallId/maps/$hn"

        Write-Host "`n[HOSTNAME: $hn]" -ForegroundColor Magenta

        # Find .webp files (e.g. 1F-map.webp, 2F-map.webp)
        $webpFiles = Get-ChildItem -Path $srcDir -Filter "*F-map.webp" -File -ErrorAction SilentlyContinue

        if ($webpFiles.Count -eq 0) {
            Write-Host "  No *F-map.webp files found. Skipping." -ForegroundColor Yellow
            continue
        }

        foreach ($webpFile in $webpFiles) {
            $baseName   = [System.IO.Path]::GetFileNameWithoutExtension($webpFile.Name)
            $uploadName = "$baseName-$today.webp"
            $updatedAt  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

            Write-Host "  File: $($webpFile.Name) -> $uploadName" -ForegroundColor Green
            Upload-WebpToS3 -LocalFile $webpFile.FullName -UploadName $uploadName -S3Base $s3Base -UpdatedAt $updatedAt -BaseName $baseName
        }

        Write-Host "  Done: $hn" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# open-times
# ---------------------------------------------------------------------------
if ($MediaType -eq "open-times" -or $MediaType -eq "all") {
    $openTimesDir = Join-Path $mediasRoot "$MallId\open-times"
    $srcFile      = Join-Path $openTimesDir "open-time.webp"

    if (-not (Test-Path $srcFile)) {
        Write-Host "Error: open-time.webp not found: $srcFile" -ForegroundColor Red
        Write-Host "Place the file at: medias\$MallId\open-times\open-time.webp" -ForegroundColor Yellow
        exit 1
    }

    $uploadName = "open-time-$today.webp"
    $updatedAt  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $s3Base     = "s3://tti-distribution/public/gido/medias/$MallId/open-times"

    Write-Host "Processing open-time image for mall: $MallId" -ForegroundColor Cyan
    Write-Host "  File: open-time.webp -> $uploadName" -ForegroundColor Green
    Upload-WebpToS3 -LocalFile $srcFile -UploadName $uploadName -S3Base $s3Base -UpdatedAt $updatedAt -BaseName "open-time"
}

# ---------------------------------------------------------------------------
# banners
# ---------------------------------------------------------------------------
if ($MediaType -eq "banners" -or $MediaType -eq "all") {
    $bannersRoot = Join-Path $mediasRoot "$MallId\banners"

    if (-not (Test-Path $bannersRoot)) {
        if ($MediaType -eq "banners") {
            Write-Host "Error: Banners directory not found: $bannersRoot" -ForegroundColor Red
            exit 1
        } else {
            Write-Host "Skipping banners: directory not found: $bannersRoot" -ForegroundColor Yellow
        }
    } else {
        $hostnameDirs = Get-ChildItem -Path $bannersRoot -Directory -ErrorAction SilentlyContinue

        if ($hostnameDirs.Count -eq 0) {
            Write-Host "No hostname directories found under: $bannersRoot" -ForegroundColor Yellow
        } else {
            Write-Host "Processing banners for layout: $MallId" -ForegroundColor Cyan
            Write-Host "Found $($hostnameDirs.Count) hostname dir(s): $($hostnameDirs.Name -join ', ')" -ForegroundColor Green

            foreach ($hostnameDir in $hostnameDirs) {
                $hn     = $hostnameDir.Name
                $srcDir = $hostnameDir.FullName
                $s3Base = "s3://tti-distribution/public/gido/medias/$MallId/banners/$hn"

                Write-Host "`n[HOSTNAME: $hn]" -ForegroundColor Magenta

                # Find banner-0.webp, banner-1.webp, ... (sorted)
                $bannerFiles = Get-ChildItem -Path $srcDir -Filter "banner-*.webp" -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^banner-\d+\.webp$' } |
                    Sort-Object Name

                if ($bannerFiles.Count -eq 0) {
                    Write-Host "  No banner-N.webp files found. Skipping." -ForegroundColor Yellow
                    continue
                }

                $updatedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
                $uploadNames = @()

                if (Get-Command aws -ErrorAction SilentlyContinue) {
                    # Remove all old timestamped banner-*.webp files for this hostname
                    Write-Host "  Cleaning old banner-*-*.webp from S3..." -ForegroundColor Cyan
                    aws s3 rm "$s3Base/" --recursive --exclude "*" --include "banner-*-*.webp" 2>&1 | Out-Null

                    foreach ($bannerFile in $bannerFiles) {
                        $baseName   = [System.IO.Path]::GetFileNameWithoutExtension($bannerFile.Name)  # e.g. "banner-0"
                        $uploadName = "$baseName-$today.webp"
                        $uploadNames += $uploadName

                        Write-Host "  File: $($bannerFile.Name) -> $uploadName" -ForegroundColor Green
                        try {
                            aws s3 cp $bannerFile.FullName "$s3Base/$uploadName" --content-type "image/webp"
                            Write-Host "  Uploaded: $uploadName" -ForegroundColor Green
                        } catch {
                            Write-Host "  Upload failed: $_" -ForegroundColor Red
                            Write-Host "  Please upload manually:" -ForegroundColor Yellow
                            Write-Host "    aws s3 cp `"$($bannerFile.FullName)`" `"$s3Base/$uploadName`" --content-type image/webp" -ForegroundColor Gray
                        }
                    }

                    # Generate and upload latest.json with files array
                    $latestJson = [PSCustomObject]@{
                        files      = $uploadNames
                        updated_at = $updatedAt
                    } | ConvertTo-Json -Compress
                    $tmpJson = [System.IO.Path]::GetTempFileName()
                    [System.IO.File]::WriteAllText($tmpJson, $latestJson, [System.Text.Encoding]::UTF8)

                    try {
                        aws s3 cp $tmpJson "$s3Base/latest.json" `
                            --content-type "application/json" `
                            --cache-control "no-cache, no-store"
                        Write-Host "  Uploaded: latest.json (files=$($uploadNames -join ', '), updated_at=$updatedAt)" -ForegroundColor Green
                    } catch {
                        Write-Host "  Failed to upload latest.json: $_" -ForegroundColor Red
                    } finally {
                        Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue
                    }
                } else {
                    Write-Host "  [INFO] AWS CLI not found. Upload manually:" -ForegroundColor Yellow
                    Write-Host "    aws s3 rm `"$s3Base/`" --recursive --exclude `"*`" --include `"banner-*-*.webp`"" -ForegroundColor Gray
                    foreach ($bannerFile in $bannerFiles) {
                        $baseName   = [System.IO.Path]::GetFileNameWithoutExtension($bannerFile.Name)
                        $uploadName = "$baseName-$today.webp"
                        $uploadNames += $uploadName
                        Write-Host "    aws s3 cp `"$($bannerFile.FullName)`" `"$s3Base/$uploadName`" --content-type image/webp" -ForegroundColor Gray
                    }
                    $filesJson = ($uploadNames | ForEach-Object { "`"$_`"" }) -join ", "
                    Write-Host "    # Then upload latest.json: { `"files`": [$filesJson], `"updated_at`": `"$updatedAt`" }" -ForegroundColor Gray
                }

                Write-Host "  Done: $hn" -ForegroundColor Green
            }
        }
    }
}

Write-Host "`nDone!" -ForegroundColor Green
