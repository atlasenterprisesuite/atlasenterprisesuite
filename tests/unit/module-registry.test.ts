import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = `${process.cwd()}/apps/web/src/modules/registry.ts`;
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS canonical module registry', () => {
  it('defines one typed registry for surfaced top-level modules', () => {
    expect(existsSync(path)).toBe(true);
    expect(source).toContain('export const ATLAS_MODULES');
    for (const id of ['work', 'business', 'finance', 'crm', 'commerce', 'payroll', 'learning', 'health', 'studio', 'hospitality', 'ride', 'voice', 'galaxy', 'security']) {
      expect(source).toContain(`id: '${id}'`);
    }
  });

  it('registers Commerce once with the canonical protected route', () => {
    expect(source).toContain("id: 'commerce'");
    expect(source).toContain("title: 'ATLAS Commerce'");
    expect(source).toContain("navLabel: 'Commerce'");
    expect(source).toContain("area: 'Business'");
    expect(source).toContain("route: '/commerce'");
    expect(source).toContain("readiness: 'partial'");
    expect(source).toContain('requiresAuth: true');
    expect(source).toContain('showInNavigation: true');
    expect((source.match(/id: 'commerce'/g) || []).length).toBe(1);
  });

  it('declares route, readiness and authentication metadata', () => {
    expect(source).toContain('route:');
    expect(source).toContain('readiness:');
    expect(source).toContain('requiresAuth:');
  });
});
