import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function inspectBuild(directory) {
  const root = resolve(directory);
  if (!existsSync(join(root, 'index.html')) || !statSync(join(root, 'index.html')).isFile()) throw new Error('ATLAS build output missing index.html');
  const assets = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in build output');
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.(?:js|css)$/.test(entry.name)) {
        const bytes = readFileSync(file);
        assets.push({ path: relative(root, file).split(sep).join('/'), bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  walk(root);
  assets.sort((a,b) => a.path.localeCompare(b.path));
  if (!assets.some(a => a.path.endsWith('.js'))) throw new Error('ATLAS build output missing JavaScript');
  return { schemaVersion: 1, assets, totalBytes: assets.reduce((a,b)=>a+b.bytes,0), totalGzipBytes: assets.reduce((a,b)=>a+b.gzipBytes,0), warnings: assets.filter(a=>a.bytes>500000).map(a=>({code:'P1_LARGE_ASSET',path:a.path,bytes:a.bytes})) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(inspectBuild(process.argv[2] || 'apps/web/dist'), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
