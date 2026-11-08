/** ATLAS Local Core private memory: encrypted JSON vault, no network or implicit prompt persistence. */
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { promises as fs, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MAX_FILE = 2 * 1024 * 1024;
const MAX_VALUE = 64 * 1024;
const MAX_ENTRIES = 512;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function vaultDirectory() {
  if (process.platform === 'win32') {
    if (!process.env.LOCALAPPDATA) throw new Error('vault_localappdata_required');
    return join(process.env.LOCALAPPDATA, 'ATLAS', 'LocalCore', 'private');
  }
  return join(homedir(), '.atlas', 'local-core');
}

async function ensurePrivateDir(dir, create) {
  let stat;
  try { stat = await fs.lstat(dir); }
  catch (error) {
    if (error.code !== 'ENOENT' || !create) throw new Error('vault_secure_install_required');
    await fs.mkdir(dir, { mode: 0o700 });
    stat = await fs.lstat(dir);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('vault_unsafe_directory');
  if (process.platform !== 'win32') {
    if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('vault_unsafe_permissions');
  }
}

async function prepareDirectory(directory) {
  const dir = directory || vaultDirectory();
  if (!directory && process.platform === 'win32') {
    await ensurePrivateDir(dir, false);
  } else if (!directory) {
    await ensurePrivateDir(join(homedir(), '.atlas'), true);
    await ensurePrivateDir(dir, true);
  } else {
    await ensurePrivateDir(dir, true);
  }
  return dir;
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== 'string' || Buffer.byteLength(passphrase, 'utf8') < 12 || Buffer.byteLength(passphrase, 'utf8') > 4096)
    throw new Error('vault_passphrase_requires_12_bytes');
}
function validateId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || id === '__proto__' || id === 'constructor') throw new Error('vault_invalid_id');
}
function deriveKey(passphrase, salt) { return scryptSync(passphrase, salt, 32, SCRYPT); }

function seal(entries, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('ATLAS-LOCAL-CORE-V1'));
    const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify({ entries }), 'utf8')), cipher.final()]);
    return JSON.stringify({ v: 1, kdf: 'scrypt-n32768-r8-p1', cipher: 'aes-256-gcm', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
  } finally { key.fill(0); }
}
function openVault(raw, passphrase) {
  let vault;
  try { vault = JSON.parse(raw); } catch { throw new Error('vault_invalid_or_corrupt'); }
  if (!vault || vault.v !== 1 || vault.kdf !== 'scrypt-n32768-r8-p1' || vault.cipher !== 'aes-256-gcm' ||
      !['salt', 'iv', 'tag', 'data'].every(k => typeof vault[k] === 'string')) throw new Error('vault_invalid_or_corrupt');
  for (const [field, bytes] of [['salt', 16], ['iv', 12], ['tag', 16]]) {
    if (Buffer.from(vault[field], 'base64').length !== bytes) throw new Error('vault_invalid_or_corrupt');
  }
  const key = deriveKey(passphrase, Buffer.from(vault.salt, 'base64'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(vault.iv, 'base64'));
    decipher.setAAD(Buffer.from('ATLAS-LOCAL-CORE-V1'));
    decipher.setAuthTag(Buffer.from(vault.tag, 'base64'));
    const data = JSON.parse(Buffer.concat([decipher.update(Buffer.from(vault.data, 'base64')), decipher.final()]).toString('utf8'));
    if (!data || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('invalid');
    const entries = Object.create(null);
    for (const [id, value] of Object.entries(data.entries)) {
      validateId(id);
      if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_VALUE) throw new Error('invalid');
      entries[id] = value;
    }
    if (Object.keys(entries).length > MAX_ENTRIES) throw new Error('invalid');
    return entries;
  } catch { throw new Error('vault_decryption_failed'); }
  finally { key.fill(0); }
}

async function load(dir, passphrase) {
  const file = join(dir, 'memory.v1.json');
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return Object.create(null); throw new Error('vault_io_failed'); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE) throw new Error('vault_unsafe_file');
  if (process.platform !== 'win32' && (stat.mode & 0o077)) throw new Error('vault_unsafe_permissions');
  return openVault(await fs.readFile(file, 'utf8'), passphrase);
}

async function persist(dir, entries, passphrase) {
  const data = seal(entries, passphrase);
  if (Buffer.byteLength(data) > MAX_FILE) throw new Error('vault_storage_limit');
  const tmp = join(dir, '.memory-' + randomBytes(16).toString('hex') + '.tmp');
  const file = join(dir, 'memory.v1.json');
  let fd;
  try {
    fd = await fs.open(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
    await fd.writeFile(data, 'utf8');
    await fd.sync();
    await fd.close(); fd = null;
    await fs.rename(tmp, file);
    if (process.platform !== 'win32') await fs.chmod(file, 0o600);
  } finally { if (fd) await fd.close(); await fs.rm(tmp, { force: true }).catch(() => {}); }
}

async function withLock(dir, fn) {
  const lockPath = join(dir, '.memory.lock');
  let fd;
  try { fd = await fs.open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600); }
  catch { throw new Error('vault_locked'); }
  try { return await fn(); }
  finally { await fd.close(); await fs.unlink(lockPath); }
}

export async function memoryList({ passphrase, directory } = {}) {
  validatePassphrase(passphrase);
  const dir = await prepareDirectory(directory);
  return Object.keys(await load(dir, passphrase)).sort();
}
export async function memoryGet({ id, passphrase, directory } = {}) {
  validateId(id); validatePassphrase(passphrase);
  const dir = await prepareDirectory(directory);
  const entries = await load(dir, passphrase);
  return Object.hasOwn(entries, id) ? entries[id] : null;
}
export async function memoryPut({ id, value, passphrase, directory } = {}) {
  validateId(id); validatePassphrase(passphrase);
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > MAX_VALUE) throw new Error('vault_invalid_value');
  const dir = await prepareDirectory(directory);
  return withLock(dir, async () => {
    const entries = await load(dir, passphrase);
    if (Object.keys(entries).length >= MAX_ENTRIES && !Object.hasOwn(entries, id)) throw new Error('vault_entry_limit');
    entries[id] = value;
    await persist(dir, entries, passphrase);
    return true;
  });
}
export async function memoryDelete({ id, passphrase, directory } = {}) {
  validateId(id); validatePassphrase(passphrase);
  const dir = await prepareDirectory(directory);
  return withLock(dir, async () => {
    const entries = await load(dir, passphrase);
    if (!Object.hasOwn(entries, id)) return false;
    delete entries[id];
    await persist(dir, entries, passphrase);
    return true;
  });
}
