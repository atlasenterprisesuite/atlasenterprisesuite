import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260919224500_frontier_awakening_campaign.sql`,
  'utf8'
);

describe('ATLAS FRONTIER Awakening campaign migration', () => {
  it('persists durable campaign stage and experience', () => {
    expect(migration).toContain('campaign_stage');
    expect(migration).toContain('experience');
    expect(migration).toContain('check (campaign_stage between 1 and 5)');
  });

  it('enforces story gates inside the server-authoritative controller', () => {
    expect(migration).toContain('frontier_campaign_gate_habitat');
    expect(migration).toContain('frontier_campaign_gate_power_core');
    expect(migration).toContain('frontier_campaign_gate_sky_grid');
    expect(migration).toContain('security definer');
  });

  it('keeps campaign state in before and after audit snapshots', () => {
    expect(migration).toContain("'campaignStage',v_run.campaign_stage");
    expect(migration).toContain("'experience',v_run.experience");
    expect(migration).toContain('frontier_events');
  });
});
