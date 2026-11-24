/** ATLAS Phone Bridge local Android adapter: no cloud, no adb shell passthrough. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const MAX_TRANSFER_BYTES = 32 * 1024 * 1024;
export const MIRROR_PRESETS = Object.freeze({
  fast: ['--max-size=1280', '--max-fps=60', '--video-bit-rate=8M', '--no-audio'],
  balanced: ['--max-size=1600', '--max-fps=60', '--video-bit-rate=12M'],
  quality: ['--max-size=1920', '--max-fps=60', '--video-bit-rate=20M']
});

export function parseAdbDevices(output) {
  if (typeof output !== 'string') throw new Error('invalid_adb_output');
  return output.split(/\r?\n/).slice(1).map((line) => {
    const match = /^([^\s]+)\s+(device|unauthorized|offline|recovery|sideload|bootloader)(?:\s|$)/.exec(line.trim());
    if (!match) return null;
    return { serial: match[1], state: match[2] };
  }).filter(Boolean);
}

export function checkedSerial(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,96}$/.test(value)) throw new Error('invalid_device_serial');
  return value;
}

export function checkedFileName(value) {
  if (typeof value !== 'string' || value.length > 160 || !/^[\p{L}\p{N}_.()\- ]+$/u.test(value) || /^\.+$/.test(value)) {
    throw new Error('invalid_file_name');
  }
  return value;
}

export function mirrorArguments(serial, preset = 'fast') {
  const selected = MIRROR_PRESETS[preset];
  if (!selected) throw new Error('invalid_mirror_preset');
  return ['--serial', checkedSerial(serial), ...selected, '--window-title=ATLAS Phone Bridge'];
}

export function remoteDownloadPath(name) {
  return `/sdcard/Download/ATLASBridge/${checkedFileName(name)}`;
}

export async function runBinary(binary, args, { execImpl = execFileAsync, timeout = 8000 } = {}) {
  try {
    const result = await execImpl(binary, args, { shell: false, timeout, windowsHide: true, maxBuffer: 256 * 1024 });
    return String(result.stdout || '');
  } catch {
    throw new Error(binary === 'adb' ? 'adb_unavailable_or_failed' : 'scrcpy_unavailable_or_failed');
  }
}

export async function listAndroidDevices(options = {}) {
  const output = await runBinary('adb', ['devices', '-l'], options);
  return parseAdbDevices(output);
}

export async function requireAuthorizedDevice(serial, options = {}) {
  checkedSerial(serial);
  const devices = await listAndroidDevices(options);
  if (!devices.some((device) => device.serial === serial && device.state === 'device')) {
    throw new Error('phone_not_authorized_or_disconnected');
  }
  return serial;
}

export async function sendToAndroid({ serial, localPath, fileName, options = {} }) {
  await requireAuthorizedDevice(serial, options);
  const name = checkedFileName(fileName);
  await runBinary('adb', ['-s', serial, 'shell', 'mkdir', '-p', '/sdcard/Download/ATLASBridge'], options);
  await runBinary('adb', ['-s', serial, 'push', localPath, remoteDownloadPath(name)], { ...options, timeout: 120_000 });
  return remoteDownloadPath(name);
}
