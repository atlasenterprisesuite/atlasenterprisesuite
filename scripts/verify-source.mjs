import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const repositoryRoots = ['apps', 'packages', 'data', 'scripts', 'public', '.github', 'docs'];
const rootFiles = ['README.md', 'package.json', 'tsconfig.json', 'eslint.config.js', 'vite.config.ts', 'vitest.config.ts', 'index.html'];
const allowed = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.md', '.html', '.yml', '.yaml']);
const runtimePrefixes = ['apps/', 'packages/', 'data/', 'public/'];
const violations = [];
const checks = [
  { name: 'placeholder href', scope: 'runtime', regex: /href\s*=\s*["']#["']/g },
  { name: 'Coming Soon placeholder', scope: 'runtime', regex: /Coming Soon/gi },
  { name: 'unsupported cure claim', scope: 'runtime', regex: /(?:HIV|Alzheimer|Parkinson|type 1 diabetes|fibrosis).{0,24}(?:is cured|has been cured|cure confirmed)/gi },
  { name: 'hard-coded private key', scope: 'all', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'hard-coded common secret', scope: 'all', regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/gi }
];

function shouldRun(check, filePath) {
  if (check.scope === 'all') return true;
  const normalized = relative(process.cwd(), filePath).replaceAll('\\', '/');
  return runtimePrefixes.some((prefix) => normalized.startsWith(prefix));
}

async function inspectFile(filePath) {
  if (!allowed.has(extname(filePath))) return;
  const text = await readFile(filePath, 'utf8');
  for (const check of checks) {
    if (!shouldRun(check, filePath)) continue;
    if (check.regex.test(text)) violations.push(`${filePath}: ${check.name}`);
    check.regex.lastIndex = 0;
  }
}

async function walk(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else await inspectFile(full);
  }
}

for (const root of repositoryRoots) await walk(root);
for (const file of rootFiles) {
  try {
    await inspectFile(file);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (violations.length) {
  console.error('ATLAS source verification failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('ATLAS source verification passed.');
