import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const registry = read('apps/web/src/modules/registry.ts');
const visuals = read('apps/web/src/modules/integration/moduleVisuals.ts');

const moduleIds = Array.from(registry.matchAll(/\bid: '([^']+)'/g), (match) => match[1]);

describe('ATLAS module visual contract', () => {
  it('defines a visual manifest for every canonical module id', () => {
    expect(moduleIds.length).toBeGreaterThan(30);
    expect(visuals).toContain('export const MODULE_VISUALS');
    expect(visuals).toContain('export function getModuleVisual');

    for (const moduleId of moduleIds) {
      expect(visuals, moduleId).toContain(`'${moduleId}': defineVisual(`);
    }
  });

  it('declares responsive AVIF and WebP sources plus focal metadata', () => {
    expect(visuals).toContain("avif: {");
    expect(visuals).toContain("640:");
    expect(visuals).toContain("1280:");
    expect(visuals).toContain("1920:");
    expect(visuals).toContain("webp: {");
    expect(visuals).toContain('focalPoint:');
    expect(visuals).toContain('family:');
    expect(visuals).toContain('master:');
  });

  it('does not silently rotate or hash unrelated module visuals', () => {
    expect(visuals).not.toContain('% MODULE_VISUALS');
    expect(visuals).not.toContain('index %');
    expect(visuals).not.toContain('Math.random');
  });
});
