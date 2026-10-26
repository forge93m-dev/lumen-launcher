# Drags the FPS element of Lumen HUD's editor with the real OS mouse (SendInput-style events on the Minecraft window).
# Args: GUI-space rect x y w h and the GUI scale, read from the mod's self-test log.
param([double]$X, [double]$Y, [double]$W, [double]$H, [double]$Scale)
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int l, t, r, b; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
}
'@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like 'Minecraft*' } | Select-Object -First 1
if (-not $p) { Write-Output 'no window'; exit 2 }
# topmost for the duration of the drag, otherwise another window may cover the game and take the mouse
[W]::SetWindowPos($p.MainWindowHandle, [IntPtr](-1), 0, 0, 0, 0, 0x0003) | Out-Null
[W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 600
$pt = New-Object W+POINT
[W]::ClientToScreen($p.MainWindowHandle, [ref]$pt) | Out-Null
$sx = $pt.x + [int](($X + $W / 2) * $Scale)
$sy = $pt.y + [int](($Y + $H / 2) * $Scale)
[void][W]::SetCursorPos($sx, $sy); Start-Sleep -Milliseconds 300
$at = New-Object W+POINT; $at.x = $sx; $at.y = $sy
$top = [W]::GetAncestor([W]::WindowFromPoint($at), 2)
Write-Output "window under cursor is the game: $($top -eq $p.MainWindowHandle)"
[W]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 200   # left down
for ($i = 1; $i -le 12; $i++) { [void][W]::SetCursorPos($sx + $i * 12, $sy + $i * 8); Start-Sleep -Milliseconds 40 }
Start-Sleep -Milliseconds 200
[W]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)                                      # left up
[W]::SetWindowPos($p.MainWindowHandle, [IntPtr](-2), 0, 0, 0, 0, 0x0003) | Out-Null
Write-Output "dragged from $sx,$sy"
