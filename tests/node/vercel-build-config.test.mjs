import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
function json(path) {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8'));
}

test('Vercel installs locked workspaces with dev build tools before building', () => {
  const config = json('vercel.json');
  const rootPackage = json('package.json');
  assert.equal(config.installCommand, 'npm ci --include=dev');
  assert.ok(rootPackage.devDependencies.typescript, 'TypeScript must be a declared build tool');
  assert.ok(rootPackage.devDependencies.vite, 'Vite must be a declared build tool');
});

test('Vercel build outputs the verified compatibility dist folder', () => {
  const config = json('vercel.json');
  const rootPackage = json('package.json');
  const webPackage = json('apps/web/package.json');
  assert.equal(config.framework, 'vite');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.match(rootPackage.scripts.build, /npm --workspace apps\/web run build/);
  assert.match(rootPackage.scripts.build, /prepare-vercel-dist\.mjs/);
  assert.match(webPackage.scripts.build, /tsc --noEmit && vite build/);
});
