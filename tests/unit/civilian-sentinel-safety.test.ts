import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('civilian sentinel safety boundaries', () => {
  const sql = readFileSync('supabase/migrations/20261018020000_atlas_civilian_sentinel_simulations.sql', 'utf8');
  const edge = readFileSync('supabase/functions/atlas-civilian-sentinel/index.ts', 'utf8');
  const worker = readFileSync('worker/entry.ts', 'utf8');

  it('enforces simulation-only data and RLS', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('simulation_only is true');
    expect(sql).toContain('owner_id = (select auth.uid())');
    expect(sql).toContain('organization_members');
    expect(sql).not.toMatch(/grant\s+.*\s+to\s+anon/i);
  });

  it('is read only and fails closed on missing credentials', () => {
    expect(edge).toContain('request.method !== "GET"');
    expect(edge).toContain('status: 401');
    expect(edge).toContain('public_alerts_enabled: false');
    expect(edge).not.toContain('service_role');
  });

  it('discloses disabled status rather than claiming operational protection', () => {
    expect(worker).toContain('/api/v1/civilian-sentinel/status');
    expect(worker).toContain('operational: false');
    expect(worker).toContain('external_actions_enabled: false');
  });
});
