import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = `${process.cwd()}/apps/web/src/modules/registry.ts`;
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS canonical module registry', () => {
  it('defines one typed registry for surfaced top-level modules', () => {
    expect(existsSync(path)).toBe(true);
    expect(source).toContain('export const ATLAS_MODULES');
    for (const id of ['work', 'business', 'finance', 'payroll', 'learning', 'health', 'studio', 'hospitality', 'ride', 'voice']) {
      expect(source).toContain(`id: '${id}'`);
    }
  });

  it('declares route, readiness and authentication metadata', () => {
    expect(source).toContain('route:');
    expect(source).toContain('readiness:');
    expect(source).toContain('requiresAuth:');
  });
});
