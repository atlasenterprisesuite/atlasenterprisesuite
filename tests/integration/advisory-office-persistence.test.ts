import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Advisory Office durable persistence contract', () => {
  it('creates organization-scoped Advisory tables with RLS', () => {
    const path = 'supabase/migrations/20260918031500_advisory_office_core.sql';
    expect(existsSync(resolve(root, path))).toBe(true);
    const sql = read(path);
    for (const table of [
      'advisory_firms',
      'advisory_firm_memberships',
      'advisory_clients',
      'advisory_engagements',
      'advisory_launch_deliverables',
      'advisory_audit_events'
    ]) {
      expect(sql).toContain(`public.${table}`);
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
    expect(sql).toContain("'advisory.read'");
    expect(sql).toContain("'advisory.manage'");
    expect(sql).toContain('public.has_identity_permission');
  });

  it('bootstraps only AW Finance firm 001 and no invented clients or engagements', () => {
    const sql = read('supabase/migrations/20260918031500_advisory_office_core.sql');
    const bootstrapStart = sql.indexOf('create or replace function public.advisory_bootstrap_default_firm');
    const clientCreateStart = sql.indexOf('create or replace function public.advisory_create_client');
    const bootstrap = sql.slice(bootstrapStart, clientCreateStart);
    expect(bootstrap).toContain('aw-finance-advisory-solutions');
    expect(bootstrap).toContain("'001'");
    expect(bootstrap).not.toMatch(/insert\s+into\s+public\.advisory_clients/i);
    expect(bootstrap).not.toMatch(/insert\s+into\s+public\.advisory_engagements/i);
  });

  it('exposes authenticated CRUD through the existing ATLAS session boundary', () => {
    const api = read('apps/web/src/lib/advisoryApi.ts');
    expect(api).toContain('getActiveAtlasOrganization');
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain('advisory_bootstrap_default_firm');
    expect(api).toContain('createAdvisoryClient');
    expect(api).toContain('createAdvisoryEngagement');
    expect(api).toContain('updateAdvisoryLaunchEvidence');
  });

  it('routes all Advisory subpaths through the identity gate', () => {
    const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
    expect(resolver).toContain("pathname.startsWith('/advisory/')");
    expect(resolver).toContain('AdvisoryRoutes');
    const routes = read('apps/web/src/modules/advisory/AdvisoryRoutes.tsx');
    for (const route of ['/advisory/clients','/advisory/engagements','/advisory/business-launch-360']) {
      expect(routes).toContain(route);
    }
  });
});
