import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const LOCK_PATH = new URL('../../package-lock.json', import.meta.url);
const EXPECTED_STALE_BLOB = '98e7afa7d4b34f1323c28370b575a073931f332e';
const EXPECTED_SYNCED_BLOB = '247a546e71f1e202aa828a52cad9f70186ee63b3';

const REQUIRED_ENTRIES = {
  'node_modules/@atlas/audit-ledger': {
    resolved: 'packages/audit-ledger',
    link: true
  },
  'node_modules/@atlas/execution': {
    resolved: 'packages/execution',
    link: true
  },
  'packages/audit-ledger': {
    name: '@atlas/audit-ledger',
    version: '0.1.0'
  },
  'packages/execution': {
    name: '@atlas/execution',
    version: '0.1.0'
  }
};

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1')
    .update(Buffer.from(`blob ${body.byteLength}\0`, 'utf8'))
    .update(body)
    .digest('hex');
}

function equalJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const source = readFileSync(LOCK_PATH, 'utf8');
const beforeSha = gitBlobSha(source);
if (![EXPECTED_STALE_BLOB, EXPECTED_SYNCED_BLOB].includes(beforeSha)) {
  throw new Error(`unexpected package-lock.json blob ${beforeSha}`);
}

const lock = JSON.parse(source);
if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object') {
  throw new Error('unsupported package-lock.json structure');
}

for (const [key, expected] of Object.entries(REQUIRED_ENTRIES)) {
  const current = lock.packages[key];
  if (current !== undefined && !equalJson(current, expected)) {
    throw new Error(`refusing to overwrite unexpected lock entry ${key}`);
  }
  lock.packages[key] = expected;
}

const root = lock.packages[''];
if (!root) throw new Error('package-lock.json root workspace entry is missing');
const rest = Object.entries(lock.packages)
  .filter(([key]) => key !== '')
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
lock.packages = { '': root, ...Object.fromEntries(rest) };

const output = `${JSON.stringify(lock, null, 2)}\n`;
const afterSha = gitBlobSha(output);
if (afterSha !== EXPECTED_SYNCED_BLOB) {
  throw new Error(`workspace lock sync produced unexpected blob ${afterSha}`);
}

if (source !== output) {
  writeFileSync(LOCK_PATH, output, 'utf8');
  console.log(`workspace lock sync: ${beforeSha} -> ${afterSha}`);
} else {
  console.log(`workspace lock already current: ${afterSha}`);
}
