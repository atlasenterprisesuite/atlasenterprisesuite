import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20261007153500_atlas_inclusive_communication_core.sql',
  'utf8'
);

describe('ATLAS Inclusive Communication database core', () => {
  it('reuses the canonical user-preferences store instead of creating a duplicate accessibility profile table', () => {
    expect(sql).toContain('public.atlas_user_preferences');
    expect(sql).not.toMatch(/create table[^;]+accessibility_profiles/i);
  });

  it('creates the durable multimodal communication model', () => {
    for (const table of [
      'atlas_inclusive_communication_sessions',
      'atlas_inclusive_communication_participants',
      'atlas_inclusive_communication_messages',
      'atlas_inclusive_communication_derivations',
      'atlas_inclusive_consents',
      'atlas_assistive_device_bindings',
      'atlas_sign_language_readiness',
      'atlas_interpreter_sessions',
      'atlas_accessibility_validation_runs',
      'atlas_accessibility_validation_evidence',
      'atlas_inclusive_audit_events'
    ]) {
      expect(sql).toContain(`public.${table}`);
    }
  });

  it('keeps provider and sign-language rollout fail closed', () => {
    expect(sql).toContain("default 'not_configured'");
    expect(sql).toContain("default 'research_only'");
    expect(sql).toContain('deaf_community_validated boolean not null default false');
  });

  it('requires tenant membership and session participation for communication access', () => {
    expect(sql).toContain('public.atlas_inclusive_can_access_session');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain('p.user_id = p_user_id');
  });

  it('enables RLS and removes anonymous table access', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on public.atlas_inclusive_communication_sessions from anon, authenticated');
    expect(sql).toContain('grant select on public.atlas_inclusive_communication_sessions to authenticated');
  });

  it('keeps raw biometric media out of the communication database layer', () => {
    expect(sql).not.toMatch(/\b(audio|video|image)_?(bytes|blob)?\s+bytea\b/i);
    expect(sql).toContain('media_reference jsonb');
  });

  it('provides governed session and message RPCs with confidence and sensitive-action gates', () => {
    expect(sql).toContain('public.atlas_inclusive_create_session');
    expect(sql).toContain('public.atlas_inclusive_append_message');
    expect(sql).toContain('p_confidence < 0.74');
    expect(sql).toContain('p_sensitive and p_confirmed is not true');
  });

  it('persists evidence for assistive technology and human validation without converting blocked external gates into pass', () => {
    expect(sql).toContain("'blocked_external'");
    expect(sql).toContain('atlas_accessibility_validation_evidence');
    expect(sql).toContain('assistive_technology');
  });
});
