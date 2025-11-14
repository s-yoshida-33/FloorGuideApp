# scripts\move_video_window.ps1
# This script moves a video player window to the top-right 16:9 area
# so that it matches the video frame in FloorGuideApp.

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

# ---------------------------------------------------------
# 1) Get primary screen resolution
# ---------------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$screenWidth  = $screen.Width
$screenHeight = $screen.Height

Write-Host "Screen: ${screenWidth}x${screenHeight}"

# ---------------------------------------------------------
# 2) Calculate top area and 16:9 video rectangle
#
#    topHeightRatio should match TOP_HEIGHT_VH / 100
#    in FloorGuideApp (currently about 0.63).
# ---------------------------------------------------------
$topHeightRatio = 0.63  # TODO: keep this in sync with FloorGuideApp

$topHeightPx = [int]($screenHeight * $topHeightRatio)

# 16:9 from height (h: topHeightPx, w: h * 16 / 9)
$videoWidthPx  = [int]($topHeightPx * 16 / 9)
$videoHeightPx = $topHeightPx

# Top-right position
$x = $screenWidth - $videoWidthPx
$y = 0

Write-Host "Target position: x=$x, y=$y, w=$videoWidthPx, h=$videoHeightPx"

# ---------------------------------------------------------
# 3) Find video player window
#
#    Replace $windowTitle with the actual window title
#    of your video player application.
# ---------------------------------------------------------
$windowTitle = "YourVideoWindowTitle"  # TODO: replace with real title

$hWnd = [Win32]::FindWindow($null, $windowTitle)

if ($hWnd -eq [IntPtr]::Zero) {
    Write-Host "Window not found. Check if the video app is running and the title is correct." -ForegroundColor Red
    exit 1
}

# Show window (SW_SHOWNORMAL = 1)
[Win32]::ShowWindow($hWnd, 1) | Out-Null

# Move and resize window
[Win32]::MoveWindow($hWnd, $x, $y, $videoWidthPx, $videoHeightPx, $true) | Out-Null

Write-Host "Video window moved and resized successfully."
