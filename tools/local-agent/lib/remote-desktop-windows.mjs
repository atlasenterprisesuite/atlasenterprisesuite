import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SESSION_TTL_MS = 30 * 60_000;
const SESSION_ID = /^[a-zA-Z0-9_-]{8,80}$/;

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function runPowerShell(script, timeout = 20_000) {
  if (process.platform !== 'win32') throw new Error('remote_desktop_windows_only');
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedPowerShell(script)],
    { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }
  );
  return String(stdout || '').trim();
}

function sessionIdFrom(payload) {
  const value = String(payload?.session_id || '').trim();
  if (!SESSION_ID.test(value)) throw new Error('remote_session_id_invalid');
  return value;
}

function modeFrom(payload) {
  const value = String(payload?.mode || 'view').trim().toLowerCase();
  if (!['view', 'control'].includes(value)) throw new Error('remote_mode_invalid');
  return value;
}

function cleanSessionMap(map) {
  const now = Date.now();
  for (const [id, session] of map.entries()) {
    if (!session || session.expiresAt <= now) map.delete(id);
  }
}

export function windowsRemoteDesktopLocalDevice() {
  return {
    external_id: 'atlas-windows-remote-desktop',
    label: 'ATLAS Remote Desktop',
    device_type: 'computer',
    adapter: 'remote-desktop-windows',
    capabilities: [
      'remote.session',
      'remote.desktop.stream',
      'remote.input.pointer',
      'remote.input.keyboard'
    ],
    health_status: 'healthy',
    metadata: {
      consent: 'local-user-required',
      capture: 'windows-gdi',
      input: 'windows-sendinput',
      transport: 'atlas-remote-relay',
      persistence: 'none'
    }
  };
}

export function createWindowsRemoteDesktopController() {
  const sessions = new Map();

  function assertSession(sessionId, requireControl = false) {
    cleanSessionMap(sessions);
    const session = sessions.get(sessionId);
    if (!session) throw new Error('remote_session_not_active');
    if (session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
      throw new Error('remote_session_expired');
    }
    if (requireControl && session.mode !== 'control') throw new Error('remote_session_view_only');
    return session;
  }

  async function requestConsent(payload) {
    const sessionId = sessionIdFrom(payload);
    const mode = modeFrom(payload);
    const requestLabel = mode === 'control' ? 'view and control this computer' : 'view this computer';
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$caption = 'ATLAS Remote'
$message = 'An authenticated ATLAS user is requesting permission to ${requestLabel}. Allow this remote session for up to 30 minutes?'
$result = [System.Windows.Forms.MessageBox]::Show($message, $caption, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
if ($result -eq [System.Windows.Forms.DialogResult]::Yes) { 'granted' } else { 'denied' }
`;
    const result = await runPowerShell(script, 120_000);
    if (!result.toLowerCase().includes('granted')) throw new Error('remote_consent_denied');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(sessionId, { sessionId, mode, expiresAt });
    return { session_id: sessionId, mode, expires_at: new Date(expiresAt).toISOString() };
  }

  function endSession(sessionId) {
    sessions.delete(sessionId);
  }

  function hasSession(sessionId) {
    try {
      assertSession(sessionId, false);
      return true;
    } catch {
      return false;
    }
  }

  async function captureFrame(sessionId, options = {}) {
    assertSession(sessionId, false);
    const width = Math.round(clampNumber(options.target_width, 480, 960, 800));
    const quality = Math.round(clampNumber(options.quality, 20, 55, 34));
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$source = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($source)
try {
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $targetWidth = [Math]::Min(${width}, $bounds.Width)
  $targetHeight = [Math]::Max(1, [int][Math]::Round($bounds.Height * ($targetWidth / [double]$bounds.Width)))
  $target = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
  $draw = [System.Drawing.Graphics]::FromImage($target)
  try {
    $draw.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $draw.DrawImage($source, 0, 0, $targetWidth, $targetHeight)
    $stream = New-Object System.IO.MemoryStream
    try {
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]${quality})
      $target.Save($stream, $codec, $parameters)
      [pscustomobject]@{
        image_base64 = [Convert]::ToBase64String($stream.ToArray())
        source_width = $bounds.Width
        source_height = $bounds.Height
        frame_width = $targetWidth
        frame_height = $targetHeight
      } | ConvertTo-Json -Compress
    } finally { $stream.Dispose() }
  } finally {
    $draw.Dispose()
    $target.Dispose()
  }
} finally {
  $graphics.Dispose()
  $source.Dispose()
}
`;
    const output = await runPowerShell(script, 25_000);
    const parsed = JSON.parse(output);
    const imageBase64 = String(parsed?.image_base64 || '');
    if (!imageBase64 || imageBase64.length > 220_000) throw new Error('remote_frame_invalid_or_too_large');
    return {
      image_base64: imageBase64,
      source_width: Number(parsed.source_width || 0),
      source_height: Number(parsed.source_height || 0),
      frame_width: Number(parsed.frame_width || 0),
      frame_height: Number(parsed.frame_height || 0)
    };
  }

  async function pointerClick(sessionId, payload) {
    assertSession(sessionId, true);
    const x = clampNumber(payload?.x, 0, 1, 0.5);
    const y = clampNumber(payload?.y, 0, 1, 0.5);
    const button = String(payload?.button || 'left').toLowerCase();
    if (!['left', 'right'].includes(button)) throw new Error('remote_pointer_button_invalid');
    const count = Math.round(clampNumber(payload?.count, 1, 2, 1));
    const down = button === 'right' ? '0x0008' : '0x0002';
    const up = button === 'right' ? '0x0010' : '0x0004';
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AtlasPointer {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
"@
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$px = $bounds.X + [int][Math]::Round((${x}) * [Math]::Max(0, $bounds.Width - 1))
$py = $bounds.Y + [int][Math]::Round((${y}) * [Math]::Max(0, $bounds.Height - 1))
[AtlasPointer]::SetCursorPos($px, $py) | Out-Null
for ($i = 0; $i -lt ${count}; $i++) {
  [AtlasPointer]::mouse_event(${down}, 0, 0, 0, [UIntPtr]::Zero)
  [AtlasPointer]::mouse_event(${up}, 0, 0, 0, [UIntPtr]::Zero)
  if (${count} -gt 1) { Start-Sleep -Milliseconds 80 }
}
'ok'
`;
    await runPowerShell(script, 10_000);
  }

  async function keyboardText(sessionId, payload) {
    assertSession(sessionId, true);
    const text = String(payload?.text || '');
    if (!text || text.length > 512) throw new Error('remote_keyboard_text_invalid');
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AtlasKeyboard {
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }
  [StructLayout(LayoutKind.Explicit)]
  public struct INPUTUNION {
    [FieldOffset(0)] public KEYBDINPUT ki;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public INPUTUNION U;
  }
  [DllImport("user32.dll", SetLastError=true)]
  static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  public static void SendText(string text) {
    foreach (char ch in text) {
      var down = new INPUT();
      down.type = 1;
      down.U.ki.wScan = ch;
      down.U.ki.dwFlags = 0x0004;
      var up = down;
      up.U.ki.dwFlags = 0x0004 | 0x0002;
      var inputs = new INPUT[] { down, up };
      if (SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT))) != 2) {
        throw new InvalidOperationException("send_input_failed");
      }
    }
  }
}
"@
$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
[AtlasKeyboard]::SendText($text)
'ok'
`;
    await runPowerShell(script, 10_000);
  }

  async function keyboardKey(sessionId, payload) {
    assertSession(sessionId, true);
    const key = String(payload?.key || '').trim().toLowerCase();
    const keys = {
      enter: 0x0d,
      backspace: 0x08,
      tab: 0x09,
      escape: 0x1b,
      delete: 0x2e,
      arrowleft: 0x25,
      arrowup: 0x26,
      arrowright: 0x27,
      arrowdown: 0x28
    };
    const virtualKey = keys[key];
    if (!virtualKey) throw new Error('remote_keyboard_key_invalid');
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AtlasKey {
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
[AtlasKey]::keybd_event(${virtualKey}, 0, 0, [UIntPtr]::Zero)
[AtlasKey]::keybd_event(${virtualKey}, 0, 2, [UIntPtr]::Zero)
'ok'
`;
    await runPowerShell(script, 10_000);
  }

  async function executeControl(sessionId, event) {
    const kind = String(event?.kind || '');
    if (kind === 'pointer.click') return pointerClick(sessionId, event);
    if (kind === 'keyboard.text') return keyboardText(sessionId, event);
    if (kind === 'keyboard.key') return keyboardKey(sessionId, event);
    throw new Error('remote_control_event_unsupported');
  }

  return {
    requestConsent,
    endSession,
    hasSession,
    captureFrame,
    executeControl
  };
}
