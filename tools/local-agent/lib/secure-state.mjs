import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

function defaultStateFile() {
  if (process.env.ATLAS_AGENT_STATE_FILE) return process.env.ATLAS_AGENT_STATE_FILE;
  if (process.platform === 'win32') {
    return path.join(process.env.ProgramData || 'C:\\ProgramData', 'ATLAS', 'LocalAgent', 'state.json');
  }
  if (process.platform === 'darwin') return '/Library/Application Support/ATLAS/LocalAgent/state.json';
  return '/var/lib/atlas/local-agent/state.json';
}

export const AGENT_STATE_FILE = path.resolve(defaultStateFile());

export async function loadAgentState() {
  try {
    const parsed = JSON.parse(await fs.readFile(AGENT_STATE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

export async function saveAgentState(state) {
  const directory = path.dirname(AGENT_STATE_FILE);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${AGENT_STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  try { await fs.chmod(temporary, 0o600); } catch {}
  await fs.rename(temporary, AGENT_STATE_FILE);
  try { await fs.chmod(AGENT_STATE_FILE, 0o600); } catch {}
}

export async function readEnrollmentCode() {
  const file = String(process.env.ATLAS_AGENT_ENROLLMENT_CODE_FILE || '').trim();
  if (file) {
    const value = (await fs.readFile(file, 'utf8')).trim();
    if (!value) throw new Error('enrollment_code_file_empty');
    return { value, file: path.resolve(file) };
  }
  const value = String(process.env.ATLAS_AGENT_ENROLLMENT_CODE || '').trim();
  return value ? { value, file: null } : null;
}

export async function consumeEnrollmentFile(file) {
  if (!file) return;
  try {
    await fs.writeFile(file, '', { mode: 0o600 });
    await fs.unlink(file);
  } catch {}
}

export async function readExplicitDevices() {
  const file = String(process.env.ATLAS_LOCAL_DEVICES_FILE || '').trim();
  const raw = file ? await fs.readFile(file, 'utf8') : String(process.env.ATLAS_LOCAL_DEVICES_JSON || '[]');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('local_devices_config_must_be_array');
  return parsed;
}

export async function readMtlsMaterial() {
  const certFile = String(process.env.ATLAS_AGENT_MTLS_CERT_FILE || '').trim();
  const keyFile = String(process.env.ATLAS_AGENT_MTLS_KEY_FILE || '').trim();
  if (!certFile || !keyFile) return null;
  const [certificate, privateKey] = await Promise.all([fs.readFile(certFile), fs.readFile(keyFile)]);
  return { certificate, privateKey, certFile: path.resolve(certFile), keyFile: path.resolve(keyFile) };
}

export function runtimeIdentity() {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    node: process.version
  };
}
