import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260918213000_atlas_local_control_plane.sql','utf8');

describe('ATLAS Local Control Plane schema', () => {
  it('registers separated Local Agent permissions', () => {
    for (const permission of ['device.agent.read','device.agent.use','device.agent.admin']) {
      expect(sql).toContain(`'${permission}'`);
    }
  });

  it('stores only digests for enrollment and sessions', () => {
    expect(sql).toContain('enrollment_code_hash');
    expect(sql).toContain('token_hash');
    expect(sql).not.toMatch(/\benrollment_code\s+text\b/i);
    expect(sql).not.toMatch(/\bsession_token\s+text\b/i);
  });

  it('keeps direct authenticated mutations behind the Edge Function', () => {
    expect(sql).toMatch(/revoke all on public\.atlas_local_agents from authenticated/i);
    expect(sql).toMatch(/grant select on public\.atlas_local_agents to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*atlas_local_agents[^;]*authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*update[^;]*atlas_local_device_commands[^;]*authenticated/i);
  });

  it('enables RLS across all control-plane records', () => {
    for (const table of [
      'atlas_local_agents','atlas_local_agent_enrollments','atlas_local_agent_sessions',
      'atlas_local_devices','atlas_local_device_commands','atlas_local_device_events'
    ]) expect(sql).toContain(`alter table public.${table} enable row level security`);
  });

  it('keeps command persistence reference-only', () => {
    expect(sql).toContain('capability text');
    expect(sql).toContain('action text');
    expect(sql).not.toMatch(/\b(action_payload|command_payload|credentials|access_token|refresh_token)\b/i);
  });
});
