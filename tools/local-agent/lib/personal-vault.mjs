/** Local-only personal credentials. Never register reveal as an AI/MCP tool. */
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { memoryGet, memoryUpdate } from './local-core-vault.mjs';

const ID = 'personal-accounts-v1';
const fail = code => { throw new Error(`personal_vault_${code}`); };

// Strict quoted CSV: CRLF, embedded commas/newlines and doubled quotes supported.
function parseCsv(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024) fail('csv_limit');
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else value += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        rows.push(row); row = [];
        if (rows.length > 501) fail('record_limit');
      }
    } else if (c === '"' && !value && !closed) quoted = true;
    else { if (closed || c === '"') fail('csv_format'); value += c; }
  }
  if (quoted) fail('csv_format');
  if (row.length || value || closed) { row.push(value); rows.push(row); }
  return rows;
}

function safeUrl(input) {
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail('url');
    return url.href;
  } catch { fail('url'); }
}
function accounts(raw) {
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed.v !== 1 || !Array.isArray(parsed.accounts)) fail('corrupt');
    return parsed.accounts;
  } catch { fail('corrupt'); }
}
function metadata(a) {
  return { id: a.id, title: a.title, url: a.url, username: a.username, source: a.source, recoveryCodeCount: a.recoveryCodes.length };
}
function imported(csv, source) {
  if (!['google', 'apple'].includes(source)) fail('source');
  const [header, ...rows] = parseCsv(csv);
  if (!header) fail('columns');
  const names = header.map(h => h.trim().toLowerCase());
  if (new Set(names).size !== names.length) fail('columns');
  const title = source === 'google' ? 'name' : 'title';
  if (![title, 'url', 'username', 'password'].every(n => names.includes(n))) fail('columns');
  return rows.map(row => {
    if (row.length !== names.length) fail('csv_format');
    const get = n => row[names.indexOf(n)] || '';
    const result = { id: randomUUID(), title: get(title), url: safeUrl(get('url')), username: get('username'), password: get('password'), notes: get(source === 'google' ? 'note' : 'notes'), source, recoveryCodes: [] };
    if (!result.title.trim() || !result.password || Object.values(result).some(v => typeof v === 'string' && v.length > 8192)) fail('record');
    return result;
  });
}

/** Each operation requires unlock; no retained passphrase, network or logging.
 * directory MUST be a dedicated private credentials directory, not Local Core memory.
 */
export function createPersonalVault({ directory } = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) fail('directory_required');
  const read = async passphrase => accounts(await memoryGet({ id: ID, directory, passphrase }));
  const update = (passphrase, fn) => memoryUpdate({ id: ID, directory, passphrase, update: raw => {
    const all = accounts(raw); fn(all);
    if (all.length > 500) fail('record_limit');
    return JSON.stringify({ v: 1, accounts: all });
  } });
  return Object.freeze({
    async importCsv({ csv, source, passphrase }) {
      const incoming = imported(csv, source);
      const result = { imported: 0, skipped: 0 };
      await update(passphrase, all => {
        for (const item of incoming) {
          const existing = all.find(a => a.url === item.url && a.username === item.username);
          if (existing) {
            if (existing.password !== item.password || existing.notes !== item.notes) fail('conflict');
            result.skipped++;
          } else { all.push(item); result.imported++; }
        }
      });
      return result;
    },
    async search({ query = '', passphrase }) {
      if (typeof query !== 'string' || query.length > 256) fail('query');
      const q = query.toLowerCase();
      return (await read(passphrase)).filter(a => [a.title, a.url, a.username].some(s => s.toLowerCase().includes(q))).map(metadata);
    },
    async reveal({ id, passphrase }) {
      return (await read(passphrase)).find(a => a.id === id) || null;
    },
    async setRecoveryCodes({ id, codes, passphrase }) {
      if (!Array.isArray(codes) || codes.length > 100 || codes.some(c => typeof c !== 'string' || !c.trim() || c.length > 256) || new Set(codes).size !== codes.length) fail('codes');
      await update(passphrase, all => {
        const a = all.find(a => a.id === id); if (!a) fail('not_found');
        a.recoveryCodes = [...codes];
      });
    },
    async remove({ id, passphrase }) {
      let removed = false;
      await update(passphrase, all => {
        const index = all.findIndex(a => a.id === id);
        if (index >= 0) { all.splice(index, 1); removed = true; }
      });
      return removed;
    }
  });
}
