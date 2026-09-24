import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = `${process.cwd()}/apps/web/src/modules/registry.ts`;
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS canonical module registry', () => {
  it('defines one typed registry for surfaced top-level modules', () => {
    expect(existsSync(path)).toBe(true);
    expect(source).toContain('export const ATLAS_MODULES');
    for (const id of ['work', 'automations', 'business', 'revenue', 'finance', 'accounting', 'tax', 'crm', 'commerce', 'inventory', 'telecom', 'people', 'payroll', 'learning', 'health', 'insurance', 'studio', 'site-review', 'frontier', 'hospitality', 'ride', 'voice', 'galaxy', 'release-control']) {
      expect(source).toContain(`id: '${id}'`);
    }
  });

  it('registers Commerce once with the canonical protected route and truthful provider gate', () => {
    const start = source.indexOf("id: 'commerce'");
    const end = source.indexOf('\n  {', start + 1);
    const block = source.slice(start, end === -1 ? source.length : end);
    expect(block).toContain("title: 'ATLAS Commerce'");
    expect(block).toContain("navLabel: 'Commerce'");
    expect(block).toContain("area: 'Business'");
    expect(block).toContain("route: '/commerce'");
    expect(block).toContain("readiness: 'external-gated'");
    expect(block).toContain('requiresAuth: true');
    expect(block).toContain('showInNavigation: true');
    expect((source.match(/id: 'commerce'/g) || []).length).toBe(1);
  });

  it('registers Inventory once with the canonical protected procure-to-pay route', () => {
    const start = source.indexOf("id: 'inventory'");
    const end = source.indexOf('\n  {', start + 1);
    const block = source.slice(start, end === -1 ? source.length : end);
    expect(block).toContain("title: 'ATLAS Inventory & Purchasing'");
    expect(block).toContain("route: '/inventory/procure-to-pay'");
    expect(block).toContain("readiness: 'implemented'");
    expect((source.match(/id: 'inventory'/g) || []).length).toBe(1);
  });

  it('declares route, readiness and authentication metadata without partial modules', () => {
    expect(source).toContain('route:');
    expect(source).toContain('readiness:');
    expect(source).toContain('requiresAuth:');
    expect(source).not.toContain("readiness: 'partial'");
  });
});
