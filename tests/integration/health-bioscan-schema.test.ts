import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261005102500_atlas_bioscan_foundation.sql', 'utf8');

const TABLES = [
  'bioscan_consents',
  'bioscan_sessions',
  'human_twin_snapshots',
  'body_landmarks',
  'body_measurements',
  'sensor_observations',
  'posture_observations'
] as const;

describe('ATLAS BioScan sensitive-data foundation', () => {
  it('creates every canonical BioScan table with organization scope and RLS', () => {
    for (const table of TABLES) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on public.${table} from anon`);
      expect(migration).toContain(`revoke insert, update, delete on public.${table} from authenticated`);
      expect(migration).toContain(`grant select on public.${table} to authenticated`);
      expect(migration).toContain(`grant all on public.${table} to service_role`);
    }
    expect(migration).toContain('tenant_id = org_id');
  });

  it('registers conservative BioScan permissions without granting cross-subject management to ordinary roles', () => {
    for (const permission of [
      'health.bioscan.read',
      'health.bioscan.capture',
      'health.bioscan.manage',
      'health.bioscan.audit'
    ]) {
      expect(migration).toContain(permission);
    }

    for (const role of ['owner', 'admin']) {
      expect(migration).toContain(`('${role}', 'health.bioscan.manage')`);
      expect(migration).toContain(`('${role}', 'health.bioscan.audit')`);
    }
    for (const role of ['manager', 'staff']) {
      expect(migration).toContain(`('${role}', 'health.bioscan.read')`);
      expect(migration).toContain(`('${role}', 'health.bioscan.capture')`);
      expect(migration).not.toContain(`('${role}', 'health.bioscan.manage')`);
      expect(migration).not.toContain(`('${role}', 'health.bioscan.audit')`);
    }
  });

  it('requires explicit body-scan consent and keeps session states aligned with the TypeScript contract', () => {
    expect(migration).toContain("scope = 'body_scan'");
    expect(migration).toContain("status in ('granted','revoked','expired')");
    expect(migration).toContain("status in ('preparing','capturing','processing','complete','partial','failed','cancelled')");
    expect(migration).toContain("capture_mode in ('camera','camera_depth','lidar')");
  });

  it('requires measurement provenance and bounded confidence', () => {
    expect(migration).toContain("source_type in ('camera_estimate','depth_sensor','lidar_measurement','wearable','smart_scale','clinical_device','medical_record','user_entered','derived_from_verified_sources')");
    expect(migration).toContain('char_length(btrim(source_ref)) > 0');
    expect(migration).toContain('confidence between 0 and 1');
    expect(migration).toContain('is_estimate boolean not null');
    expect(migration).toContain('method_version text not null');
    expect(migration).toContain("source_type <> 'camera_estimate' or is_estimate = true");
  });

  it('makes Human Digital Twin snapshots immutable and does not introduce raw-frame storage', () => {
    expect(migration).toContain('atlas_bioscan_reject_snapshot_update');
    expect(migration).toContain('before update on public.human_twin_snapshots');
    expect(migration).toContain("raise exception 'human_twin_snapshot_immutable'");
    expect(migration).not.toMatch(/create table if not exists public\.(bioscan_)?(raw_)?(frames|images|videos)/i);
  });

  it('requires subject scope in addition to active organization membership', () => {
    expect(migration).toContain("om.status = 'active'");
    expect(migration).toContain("public.has_identity_permission(org_id, 'health.bioscan.read')");
    expect(migration).toContain("public.has_identity_permission(org_id, 'health.bioscan.manage')");
    expect(migration).toContain('subject_user_id = (select auth.uid())');
    expect(migration).toContain("or public.has_identity_permission(org_id, 'health.bioscan.manage')");
  });
});
