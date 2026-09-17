import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(`${process.cwd()}/apps/web/src/components/AtlasShell.tsx`, 'utf8');

describe('ATLAS shell module-registry navigation contract', () => {
  it('consumes canonical registry navigation instead of a local hardcoded module list', () => {
    expect(source).toContain("from '../modules/registry'");
    expect(source).toContain('ATLAS_NAV_ITEMS');
    expect(source).not.toContain('const navItems = [');
  });
});
