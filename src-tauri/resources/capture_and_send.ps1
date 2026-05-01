# capture_and_send.ps1
# Captures the primary screen and POSTs it as JPEG to Bridge-Ground.
#
# Strategy:
#   1. GDI CopyFromScreen  — reads from DWM's desktop surface (fast, no dependencies)
#   2. PrintWindow fallback — forces compositor re-render if GDI returns blank
#
# Both capture paths resize to max 1920 px wide before sending.

param(
    [Parameter(Mandatory=$true)][string]$BridgeUrl,
    [Parameter(Mandatory=$true)][string]$AppId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# ---------------------------------------------------------------------------
# PrintWindow helper (C# via Add-Type — loaded once per process)
# ---------------------------------------------------------------------------
Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
public static class WinCap {
    const uint PW_RENDERFULLCONTENT = 0x00000002;
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool   PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] static extern bool   GetWindowRect(IntPtr hwnd, out RECT r);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static Bitmap Capture() {
        IntPtr hwnd = GetForegroundWindow();
        RECT r;
        if (!GetWindowRect(hwnd, out r))
            throw new Exception("GetWindowRect failed");
        int w = r.Right  - r.Left;
        int h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0)
            throw new Exception(string.Format("Invalid window rect: {0}x{1}", w, h));
        var bmp = new Bitmap(w, h);
        using (var g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc();
            PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT);
            g.ReleaseHdc(hdc);
        }
        return bmp;
    }
}
"@

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Get-GdiScreenshot {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp    = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $g      = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $g.Dispose()
    return $bmp
}

function Get-PrintWindowScreenshot {
    return [WinCap]::Capture()
}

# Sample brightness across the image; returns $true when the frame is blank.
function Test-Blank([System.Drawing.Bitmap]$bmp) {
    $stepX = [Math]::Max(1, [int]($bmp.Width  / 24))
    $stepY = [Math]::Max(1, [int]($bmp.Height / 24))
    for ($y = 0; $y -lt $bmp.Height; $y += $stepY) {
        for ($x = 0; $x -lt $bmp.Width; $x += $stepX) {
            if ($bmp.GetPixel($x, $y).GetBrightness() -gt 0.02) { return $false }
        }
    }
    return $true
}

# Returns $true when the image lacks meaningful colour variation
# (solid CSS-fill artefact from partial DirectComposition capture).
function Test-Uniform([System.Drawing.Bitmap]$bmp) {
    $stepX  = [Math]::Max(1, [int]($bmp.Width  / 20))
    $stepY  = [Math]::Max(1, [int]($bmp.Height / 20))
    $minB   = 765; $maxB = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $stepY) {
        for ($x = 0; $x -lt $bmp.Width; $x += $stepX) {
            $px = $bmp.GetPixel($x, $y)
            $b  = [int]$px.R + [int]$px.G + [int]$px.B
            if ($b -lt $minB) { $minB = $b }
            if ($b -gt $maxB) { $maxB = $b }
        }
    }
    return ($maxB - $minB) -lt 60   # range < 60/765 => near-uniform
}

function Resize-Bitmap([System.Drawing.Bitmap]$src, [int]$maxWidth) {
    if ($src.Width -le $maxWidth) { return $src }
    $newH = [int]($src.Height * ($maxWidth / $src.Width))
    $dst  = New-Object System.Drawing.Bitmap($maxWidth, $newH)
    $g    = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $maxWidth, $newH)
    $g.Dispose()
    $src.Dispose()
    return $dst
}

function ConvertTo-JpegBytes([System.Drawing.Bitmap]$bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    return $bytes
}

# ---------------------------------------------------------------------------
# Main: capture with fallback, resize, POST
# ---------------------------------------------------------------------------

$bmp    = $null
$method = 'GDI'

try {
    $bmp = Get-GdiScreenshot
    if ((Test-Blank $bmp) -or (Test-Uniform $bmp)) {
        Write-Host "GDI frame unusable, switching to PrintWindow..."
        $bmp.Dispose()
        $bmp    = Get-PrintWindowScreenshot
        $method = 'PrintWindow'
    }
} catch {
    Write-Warning "GDI error: $_"
    if ($null -ne $bmp) { $bmp.Dispose(); $bmp = $null }
    $bmp    = Get-PrintWindowScreenshot
    $method = 'PrintWindow'
}

$bmp   = Resize-Bitmap $bmp 1920
$bytes = ConvertTo-JpegBytes $bmp
$bmp.Dispose()

$uri = "$BridgeUrl/api/apps/$AppId/screenshot"
Invoke-RestMethod -Uri $uri -Method POST -Body $bytes -ContentType 'image/jpeg' | Out-Null

Write-Host "Screenshot sent via $method ($($bytes.Length) bytes)"
