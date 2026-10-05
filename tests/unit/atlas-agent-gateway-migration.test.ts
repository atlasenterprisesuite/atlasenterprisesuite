import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baseSource = readFileSync('supabase/migrations/20260912_atlas_work_runtime.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261004_atlas_agent_gateway.sql', 'utf8');
const connectionSource = readFileSync('supabase/functions/atlas-execution/work-connections.ts', 'utf8');

const HEALTH_VALUES = [
  'unknown',
  'healthy',
  'degraded',
  'reauth_required',
  'insufficient_scope',
  'account_changed',
  'runtime_unavailable',
  'unavailable'
] as const;

describe('ATLAS Agent Gateway migration', () => {
  it('extends the canonical connection registry additively', () => {
    expect(baseSource).toContain('create table if not exists public.execution_connection_refs');
    expect(baseSource).toContain('external_ref text not null');
    expect(migration).toContain('alter table public.execution_connection_refs');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?external_ref/i);

    for (const column of [
      'display_label',
      'provider_account_ref',
      'provider_tenant_ref',
      'principal_label',
      'transport_capabilities',
      'health_state',
      'verified_at',
      'expires_at',
      'last_checked_at',
      'last_error_code'
    ]) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
  });

  it('pins the exact fail-closed health state contract', () => {
    for (const value of HEALTH_VALUES) expect(migration).toContain(`'${value}'`);
    expect(migration).toContain('health_state');
    expect(migration).toContain('check');
    expect(migration).toContain('execution_connection_refs_gateway_readiness_idx');
    expect(migration).toContain('(org_id, tenant_id, status, health_state, updated_at desc)');
  });

  it('does not introduce secret-bearing connection columns or client grants', () => {
    expect(migration).not.toMatch(/add\s+column[^;]*(?:access_token|refresh_token|password|cookie|authorization|recovery|secret)/i);
    expect(migration).not.toMatch(/grant\s+[^;]+\s+to\s+authenticated/i);
    expect(baseSource).toContain('revoke all on public.execution_connection_refs from authenticated');
  });

  it('returns sanitized readiness metadata without returning external_ref', () => {
    const projections = [...connectionSource.matchAll(/\.select\('([^']+)'\)/g)].map((match) => match[1]);
    expect(projections.length).toBeGreaterThan(0);
    expect(projections.join(',')).toContain('health_state');
    expect(projections.join(',')).toContain('transport_capabilities');
    expect(projections.join(',')).toContain('verified_at');
    for (const projection of projections) expect(projection).not.toContain('external_ref');
  });
});
