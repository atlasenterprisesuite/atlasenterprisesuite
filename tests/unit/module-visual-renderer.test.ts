import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const renderer = read('apps/web/src/modules/integration/ModuleVisual.tsx');
const suite = read('apps/web/src/modules/integration/AtlasSuitePage.tsx');

 describe('ATLAS responsive module visual renderer', () => {
  it('renders AVIF and WebP responsive sources from canonical metadata', () => {
    expect(renderer).toContain('<picture');
    expect(renderer).toContain('type="image/avif"');
    expect(renderer).toContain('type="image/webp"');
    expect(renderer).toContain('640w');
    expect(renderer).toContain('1280w');
    expect(renderer).toContain('1920w');
    expect(renderer).toContain('srcSet');
    expect(renderer).toContain('sizes=');
  });

  it('applies focal metadata and explicit loading priority without stretching', () => {
    expect(renderer).toContain('--atlas-visual-focal-point');
    expect(renderer).toContain("loading={priority ? 'eager' : 'lazy'}");
    expect(renderer).toContain("fetchPriority={priority ? 'high' : 'auto'}");
    expect(renderer).toContain('width={2048}');
    expect(renderer).toContain('height={1152}');
  });

  it('is the single renderer used by primary and A-Z module cards', () => {
    expect(suite).toContain("import { ModuleVisual } from './ModuleVisual'");
    expect(suite).toContain('<ModuleVisual');
    expect(suite).not.toContain('src={system.visual.master}');
    expect(suite).not.toContain('src={getModuleVisual(module.id).master}');
  });
});
