import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260923201500_atlas_people_core.sql');
const api = read('apps/web/src/modules/people/peopleApi.ts');
const routes = read('apps/web/src/modules/people/PeopleRoutes.tsx');
const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
const permissions = read('packages/core/src/permissions.ts');
const registry = read('apps/web/src/modules/registry.ts');

describe('ATLAS People final core', () => {
  it('persists governed organization-scoped People domains with RLS', () => {
    for (const table of [
      'people_workers','people_time_entries','people_requisitions','people_candidates',
      'people_applications','people_compensation','people_deductions'
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.audit_row_change()');
    expect(migration).toContain("public.has_identity_permission(org_id,'hr.read')");
    expect(migration).toContain("public.has_identity_permission(org_id,'payroll.read')");
    expect(migration).toContain('revoke insert, update, delete');
  });

  it('keeps browser writes behind governed People RPCs', () => {
    for (const rpc of [
      'people_create_worker','people_update_worker','people_create_time_entry',
      'people_transition_time_entry','people_create_requisition','people_create_candidate',
      'people_create_application','people_transition_application','people_set_compensation','people_set_deduction'
    ]) {
      expect(migration).toContain(`function public.${rpc}`);
      expect(api).toContain(`'${rpc}'`);
    }
  });

  it('mounts the complete People route family on current ATLAS Identity', () => {
    expect(resolver).toContain("pathname === '/people' || pathname.startsWith('/people/')");
    expect(resolver).toContain('<RequireAtlasIdentity><PeopleRoutes /></RequireAtlasIdentity>');
    for (const route of ['/people/workers','/people/time','/people/recruiting','/people/compensation','/people/self-service']) {
      expect(routes).toContain(`path="${route}"`);
    }
    expect(routes).toContain('No local or simulated records are substituted.');
  });

  it('uses typed HR and payroll permissions and closes registry readiness', () => {
    expect(permissions).toContain("export type HrPermission");
    expect(permissions).toContain("export type PayrollPermission");
    for (const permission of ['hr.read','hr.write','payroll.read','payroll.write','payroll.approve','payroll.self']) {
      expect(permissions).toContain(`'${permission}'`);
    }
    const start = registry.indexOf("id: 'people'");
    const block = registry.slice(start, registry.indexOf('\n  {', start + 1));
    expect(block).toContain("readiness: 'implemented'");
  });
});
