# Map / open-time image S3 upload script for Gido
# Usage:
#   # Upload maps (default)
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada"
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada" -MediaType maps
#
#   # Upload open-time image
#   powershell -ExecutionPolicy Bypass -File .\build\upload-maps.ps1 -MallId "sakaikitahanada" -MediaType open-times
#
# --- maps ---
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
#
# --- open-times ---
# Reads medias/open-times/{MallId}/open-time.webp
#   - Uploads with timestamp: open-time-{timestamp}.webp
#   - Generates latest.json: { "file": "...", "updated_at": "..." }
#   - Uploads to S3: s3://tti-distribution/public/gido/medias/open-times/{MallId}/
#
# Local source layout:
#   medias/open-times/{MallId}/open-time.webp
#
# S3 output layout:
#   s3://tti-distribution/public/gido/medias/open-times/{MallId}/open-time-{timestamp}.webp
#   s3://tti-distribution/public/gido/medias/open-times/{MallId}/latest.json

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
$validMediaTypes = @("maps", "open-times", "all")
if ([string]::IsNullOrWhiteSpace($MediaType) -or $MediaType -notin $validMediaTypes) {
    Write-Host "Media type? [maps / open-times / all] (default: maps): " -NoNewline
    $input = Read-Host
    if ([string]::IsNullOrWhiteSpace($input)) {
        $MediaType = "maps"
    } elseif ($input -in $validMediaTypes) {
        $MediaType = $input
    } else {
        Write-Host "Error: Invalid media type '$input'. Choose from: maps, open-times, all." -ForegroundColor Red
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

    # Per-floor latest.json name: "2F-map-latest.json"
    $latestJsonName = "$BaseName-latest.json"

    if (Get-Command aws -ErrorAction SilentlyContinue) {
        # Remove only old timestamped files for THIS floor (keep other floors and latest.json files)
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

        # Generate and upload per-floor latest.json
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
    $mapsDir = Join-Path $mediasRoot "maps\$MallId"

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
    $openTimesDir = Join-Path $mediasRoot "open-times\$MallId"
    $srcFile      = Join-Path $openTimesDir "open-time.webp"

    if (-not (Test-Path $srcFile)) {
        Write-Host "Error: open-time.webp not found: $srcFile" -ForegroundColor Red
        Write-Host "Place the file at: medias\open-times\$MallId\open-time.webp" -ForegroundColor Yellow
        exit 1
    }

    $uploadName = "open-time-$today.webp"
    $updatedAt  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $s3Base     = "s3://tti-distribution/public/gido/medias/open-times/$MallId"

    Write-Host "Processing open-time image for mall: $MallId" -ForegroundColor Cyan
    Write-Host "  File: open-time.webp -> $uploadName" -ForegroundColor Green
    Upload-WebpToS3 -LocalFile $srcFile -UploadName $uploadName -S3Base $s3Base -UpdatedAt $updatedAt -BaseName "open-time"
}

Write-Host "`nDone!" -ForegroundColor Green
