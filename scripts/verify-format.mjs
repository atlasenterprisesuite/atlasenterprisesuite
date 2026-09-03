import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['apps', 'packages', 'data', 'scripts'];
const allowed = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.json']);
const violations = [];

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
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!allowed.has(extname(entry.name))) continue;

    const text = await readFile(full, 'utf8');
    if (!text.endsWith('\n')) violations.push(`${full}: missing final newline`);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) violations.push(`${full}:${index + 1}: trailing whitespace`);
      if (line.includes('\t')) violations.push(`${full}:${index + 1}: tab character; use spaces`);
    });
  }
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error('ATLAS format verification failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('ATLAS format verification passed.');
