import { cpSync, existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep canonical Vite output for Cloudflare while also supplying root/dist
// to Vercel projects still configured for the default static output path.
export function prepareVercelDist(repoRoot = process.cwd()) {
  const root = resolve(repoRoot);
  const source = join(root, 'apps/web/dist');
  const output = join(root, 'dist');
  const requiredFiles = ['index.html', 'deployment.json'];

  for (const name of requiredFiles) {
    if (!existsSync(join(source, name))) {
      throw new Error(`ATLAS P0: missing generated ${name} in apps/web/dist; refusing to publish an empty dist`);
    }
  }

  const stage = join(root, `.vercel-dist-stage-${process.pid}-${Date.now()}`);
  try {
    cpSync(source, stage, { recursive: true });
    for (const name of requiredFiles) {
      if (readFileSync(join(source, name)).compare(readFileSync(join(stage, name))) !== 0) {
        throw new Error(`ATLAS P0: copied ${name} differs from canonical build`);
      }
    }
    // Replace generated content only after the staging copy passed validation.
    rmSync(output, { recursive: true, force: true });
    renameSync(stage, output);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }

  process.stdout.write('ATLAS Vercel compatibility output ready: dist/index.html and dist/deployment.json\n');
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareVercelDist();
}
