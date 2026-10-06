import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyModuleVisualCollection } from '../../scripts/verify-module-visuals.mjs';

const roots = [];
const tinyWebp = Buffer.from('UklGRjIAAABXRUJQVlA4ICYAAABwAQCdASoBAAEAAMASJZQCdAFAAAD+/qV09a8/ciVHBskU12AAAA==', 'base64');

async function makeRoot() {
  const root = await mkdtemp(join(tmpdir(), 'atlas-visual-gate-'));
  roots.push(root);
  return root;
}

function registrySource(ids) {
  return `export const ATLAS_MODULES = [${ids.map((id) => `{ id: '${id}' }`).join(',')}];`;
}

function manifestSource(entries) {
  return `export const MODULE_VISUALS = {\n${entries.map(({ key, source = key, focal = '50% 50%' }) => `  '${key}': defineVisual('${source}', 'Platform', '${focal}'),`).join('\n')}\n};`;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('ATLAS module image quality gate', () => {
  it('fails closed when a canonical module has no committed visual assets', async () => {
    const rootDir = await makeRoot();
    const result = await verifyModuleVisualCollection({
      rootDir,
      registrySource: registrySource(['cloud']),
      manifestSource: manifestSource([{ key: 'cloud' }])
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('cloud') && error.includes('missing asset'))).toBe(true);
  });

  it('rejects an undersized master even when the file is a valid WebP', async () => {
    const rootDir = await makeRoot();
    const dir = join(rootDir, 'apps/web/public/atlas/visuals/modules/cloud');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'master.webp'), tinyWebp);

    const result = await verifyModuleVisualCollection({
      rootDir,
      registrySource: registrySource(['cloud']),
      manifestSource: manifestSource([{ key: 'cloud' }])
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('master width 1') && error.includes('2048'))).toBe(true);
  });

  it('rejects malformed focal metadata and mismatched visual identity', async () => {
    const rootDir = await makeRoot();
    const result = await verifyModuleVisualCollection({
      rootDir,
      registrySource: registrySource(['cloud']),
      manifestSource: manifestSource([{ key: 'cloud', source: 'work', focal: 'banana' }])
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('invalid focal point'))).toBe(true);
    expect(result.errors.some((error) => error.includes('maps to work'))).toBe(true);
  });

  it('rejects duplicate master artwork assigned to unrelated modules', async () => {
    const rootDir = await makeRoot();
    for (const id of ['cloud', 'work']) {
      const dir = join(rootDir, `apps/web/public/atlas/visuals/modules/${id}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'master.webp'), tinyWebp);
    }

    const result = await verifyModuleVisualCollection({
      rootDir,
      registrySource: registrySource(['cloud', 'work']),
      manifestSource: manifestSource([{ key: 'cloud' }, { key: 'work' }])
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('duplicate master artwork'))).toBe(true);
  });
});
