import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');

test('ATLAS sovereign build does not require a legacy Vercel packaging step', () => {
  assert.match(pkg.scripts.build, /npm --workspace apps\/web run build/);
  assert.match(pkg.scripts.build, /write-deployment-manifest\.mjs/);
  assert.doesNotMatch(pkg.scripts.build, /prepare-vercel-dist|vercel/i);
  assert.match(wrangler, /"directory"\s*:\s*"\.\/apps\/web\/dist"/);
});

test('legacy Vercel packaging remains opt-in and never changes the canonical build', () => {
  assert.equal(
    pkg.scripts['build:vercel:legacy'],
    'npm run build && node scripts/prepare-vercel-dist.mjs'
  );
});
