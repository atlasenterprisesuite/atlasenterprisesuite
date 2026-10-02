import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261002184539_atlas_urban_twin_core.sql', 'utf8');
const repository = readFileSync('apps/web/src/modules/city/urbanTwinRepository.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/city/UrbanTwinPage.tsx', 'utf8');
const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const district = readFileSync('apps/web/src/modules/city/AtlasDigitalDistrictPage.tsx', 'utf8');

describe('ATLAS Urban Twin Core', () => {
  it('persists tenant-scoped entities, bindings and observations behind RLS', () => {
    for (const table of ['atlas_urban_twin_entities', 'atlas_urban_twin_bindings', 'atlas_urban_twin_observations']) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('tenant_id = org_id');
    expect(migration).toContain("city.twin.read");
    expect(migration).toContain("city.twin.manage");
    expect(migration).toContain('revoke insert, update, delete on public.atlas_urban_twin_entities from authenticated');
    expect(migration).toContain('grant all on public.atlas_urban_twin_observations to service_role');
  });

  it('loads only the active organization through the canonical authenticated session', () => {
    expect(repository).toContain('getActiveAtlasOrganization');
    expect(repository).toContain('/rest/v1/atlas_urban_twin_entities?org_id=');
    expect(repository).toContain('/rest/v1/atlas_urban_twin_bindings?org_id=');
    expect(repository).toContain('/rest/v1/atlas_urban_twin_observations?org_id=');
    expect(repository).not.toContain("method: 'POST'");
  });

  it('keeps the live twin surface evidence-aware and browser read-only', () => {
    expect(page).toContain('Physical reality, represented with evidence');
    expect(page).toContain('The browser is read-only');
    expect(page).toContain('No registered twin entities');
    expect(page).toContain('No observations received');
    expect(page).toContain('No verified adapters');
  });

  it('registers a protected route and links the Digital District to it', () => {
    expect(app).toContain('path="/city/twin"');
    expect(app).toContain('<RequireAtlasIdentity><UrbanTwinPage /></RequireAtlasIdentity>');
    expect(district).toContain("to: '/city/twin'");
  });
});
