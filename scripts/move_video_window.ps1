# scripts\move_video_window.ps1
# This script moves a video player window to the top-right 16:9 area
# so that it matches the video frame in GidoApp.

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X, int Y,
        int cx, int cy,
        uint uFlags);

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

    public const UInt32 SWP_NOSIZE     = 0x0001;
    public const UInt32 SWP_NOMOVE     = 0x0002;
    public const UInt32 SWP_NOZORDER   = 0x0004;
    public const UInt32 SWP_SHOWWINDOW = 0x0040;
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
# 2) Calculate top area and 9:16 video rectangle
# ---------------------------------------------------------
$topHeightRatio = 0.63  # keep this in sync with TOP_HEIGHT_VH / 100

$topHeightPx = [int]($screenHeight * $topHeightRatio)
$videoWidthPx  = [int]($topHeightPx * 9 / 16)
$videoHeightPx = $topHeightPx

$x = $screenWidth - $videoWidthPx
$y = 0

Write-Host "Target position: x=$x, y=$y, w=$videoWidthPx, h=$videoHeightPx"

# ---------------------------------------------------------
# 3) Find video player window by partial title
#
#    Put a distinctive keyword from the window title here.
#    Example: if the title is "VLC media player", use "VLC".
# ---------------------------------------------------------
$titleKeyword = "wsp"   # TODO: change to your app's keyword

$proc = Get-Process |
  Where-Object { $_.MainWindowTitle -like "*$titleKeyword*" } |
  Select-Object -First 1

if (-not $proc) {
    Write-Host "Window not found. Check if the video app is running and the keyword is correct." -ForegroundColor Red
    exit 1
}

$hWnd = $proc.MainWindowHandle
Write-Host "Found window: $($proc.MainWindowTitle) (PID: $($proc.Id))"

# Show window (SW_SHOWNORMAL = 1)
[Win32]::ShowWindow($hWnd, 1) | Out-Null

# Move and resize window
[Win32]::MoveWindow($hWnd, $x, $y, $videoWidthPx, $videoHeightPx, $true) | Out-Null

[Win32]::SetWindowPos(
    $hWnd,
    [Win32]::HWND_TOPMOST,
    0, 0, 0, 0,
    [Win32]::SWP_NOMOVE -bor [Win32]::SWP_NOSIZE -bor [Win32]::SWP_SHOWWINDOW
) | Out-Null

Write-Host "Video window moved and resized successfully."
