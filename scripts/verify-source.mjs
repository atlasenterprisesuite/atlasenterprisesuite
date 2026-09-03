import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['apps', 'packages', 'data'];
const allowed = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md']);
const violations = [];
const checks = [
  { name: 'placeholder href', regex: /href\s*=\s*["']#["']/g },
  { name: 'Coming Soon placeholder', regex: /Coming Soon/gi },
  { name: 'hard-coded private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'hard-coded common secret', regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/gi },
  { name: 'unsupported cure claim', regex: /(?:HIV|Alzheimer|Parkinson|type 1 diabetes|fibrosis).{0,24}(?:is cured|has been cured|cure confirmed)/gi }
];

async function walk(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (allowed.has(extname(entry.name))) {
      const text = await readFile(full, 'utf8');
      for (const check of checks) {
        if (check.regex.test(text)) violations.push(`${full}: ${check.name}`);
        check.regex.lastIndex = 0;
      }
    }
  }
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error('ATLAS source verification failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('ATLAS source verification passed.');
