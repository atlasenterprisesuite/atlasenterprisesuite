import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareVercelDist } from '../../scripts/prepare-vercel-dist.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'atlas-vercel-dist-'));
  const source = join(root, 'apps/web/dist');
  mkdirSync(join(source, 'assets'), { recursive: true });
  writeFileSync(join(source, 'index.html'), '<main>ATLAS</main>');
  writeFileSync(join(source, 'deployment.json'), '{"commit_sha":"abc123"}');
  writeFileSync(join(source, 'assets/app.js'), 'console.log("atlas")');
  return { root, source };
}

test('produces root dist containing the real web assets and exact manifest', () => {
  const { root, source } = fixture();
  try {
    prepareVercelDist(root);
    for (const file of ['index.html', 'deployment.json', 'assets/app.js']) {
      assert.equal(readFileSync(join(root, 'dist', file), 'utf8'), readFileSync(join(source, file), 'utf8'));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('removes stale generated files instead of publishing them again', () => {
  const { root } = fixture();
  try {
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'stale.js'), 'old');
    prepareVercelDist(root);
    assert.equal(existsSync(join(root, 'dist', 'stale.js')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fails closed without a built index and leaves existing root output unchanged', () => {
  const { root, source } = fixture();
  try {
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'keep.txt'), 'preserved');
    rmSync(join(source, 'index.html'));
    assert.throws(() => prepareVercelDist(root), /ATLAS P0: missing generated index.html/);
    assert.equal(readFileSync(join(root, 'dist', 'keep.txt'), 'utf8'), 'preserved');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fails closed if deployment manifest is missing', () => {
  const { root, source } = fixture();
  try {
    rmSync(join(source, 'deployment.json'));
    assert.throws(() => prepareVercelDist(root), /ATLAS P0: missing generated deployment.json/);
    assert.equal(existsSync(join(root, 'dist')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
