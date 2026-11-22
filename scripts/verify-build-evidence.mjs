import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function inspectBuild(directory, expectedSha, expectedRun) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha || '') || !expectedRun) throw new Error('Missing exact build identity');
  const root = resolve(directory);
  const files = [];
  function walk(dir, prefix = '') {
    if (!lstatSync(dir).isDirectory()) throw new Error('Build directory is not a real directory');
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const relative = prefix + name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed in build output');
      if (stat.isDirectory()) walk(path, relative + '/');
      else if (stat.isFile()) {
        const bytes = readFileSync(path);
        files.push({ path: relative, size: bytes.length, sha256: hash(bytes) });
      } else throw new Error('Unexpected build output type');
    }
  }
  walk(root);
  files.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!files.some(f => f.path === 'index.html' && f.size > 0)) throw new Error('Missing index.html');
  const manifest = JSON.parse(readFileSync(join(root,'deployment.json'),'utf8'));
  if (manifest.commit_sha !== expectedSha || String(manifest.run_id) !== String(expectedRun) || manifest.service !== 'atlas-enterprise-suite-web') throw new Error('Build manifest identity mismatch');
  return { commit_sha: expectedSha, run_id: String(expectedRun), file_count: files.length, tree_sha256: hash(JSON.stringify(files)), files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evidence = inspectBuild(process.argv[2], process.argv[3], process.argv[4]);
  console.log(JSON.stringify(evidence));
}
