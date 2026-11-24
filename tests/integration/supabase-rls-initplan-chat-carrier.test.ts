import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Static contract tests for the migration. Live tenant-isolation / authenticated
 * RLS exercises must run against an isolated Supabase branch before deployment.
 */
const migration = readFileSync(
  'supabase/migrations/20261008111500_atlas_rls_auth_initplan_chat_carrier.sql',
  'utf8',
);
const chat = readFileSync('supabase/migrations/20260925031000_atlas_chat_core.sql', 'utf8');
const carrier = readFileSync('supabase/migrations/20260927120000_atlas_carrier_numbering.sql', 'utf8');
const telephony = readFileSync('supabase/migrations/20260926201000_atlas_communication_telephony.sql', 'utf8');

const chatPolicies = [
  ['atlas_chat_retention_policies', 'atlas_chat_retention_read'],
  ['atlas_chat_conversations', 'atlas_chat_conversation_read'],
  ['atlas_chat_participants', 'atlas_chat_participant_read'],
  ['atlas_chat_messages', 'atlas_chat_message_read'],
  ['atlas_chat_message_receipts', 'atlas_chat_receipt_read'],
  ['atlas_chat_message_reactions', 'atlas_chat_reaction_read'],
  ['atlas_chat_deletion_requests', 'atlas_chat_deletion_read'],
  ['atlas_chat_attachments', 'atlas_chat_attachment_read'],
] as const;

const carrierPolicies = [
  ['atlas_numbering_authorizations', 'atlas_numbering_authorizations_member_read'],
  ['atlas_number_resources', 'atlas_number_resources_member_read'],
  ['atlas_telephony_providers', 'atlas_telephony_providers_member_read'],
  ['atlas_call_sessions', 'atlas_call_sessions_member_read'],
  ['atlas_call_events', 'atlas_call_events_member_read'],
] as const;

describe('Supabase RLS initplan fix for ATLAS Chat and Carrier (#712)', () => {
  it('targets exactly the 13 existing named SELECT policies without introducing new access', () => {
    const rows = [...migration.matchAll(
      /\('([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z_.]+)'\)/g,
    )].map((m) => [m[1], m[2]]);
    expect(rows).toHaveLength(13);
    expect(rows).toEqual([...chatPolicies, ...carrierPolicies]);
    for (const [table, policy] of chatPolicies) {
      expect(chat).toContain(`create policy ${policy}`);
      expect(migration).toContain(`'${table}', '${policy}'`);
    }
    for (const [table, policy] of carrierPolicies) {
      expect(carrier + telephony).toContain(`create policy ${policy}`);
      expect(migration).toContain(`'${table}', '${policy}'`);
    }
  });

  it('preflights fail-closed role, command, RLS, permission predicate and all targets before changing any policy', () => {
    expect(migration).toContain("v_policy.roles::text <> '{authenticated}'");
    expect(migration).toContain("v_policy.cmd <> 'SELECT'");
    expect(migration).toContain("v_policy.permissive <> 'PERMISSIVE'");
    expect(migration).toContain('v_policy.qual IS NULL');
    expect(migration).toContain('v_target.guard_fragment');
    expect(migration).toContain('relrowsecurity');
    expect(migration).toContain('IF v_total <> 13 THEN');
    const firstAlter = migration.indexOf("EXECUTE format('ALTER POLICY");
    expect(firstAlter).toBeGreaterThan(migration.indexOf('IF v_total <> 13 THEN'));
    expect(firstAlter).toBeGreaterThan(migration.indexOf('-- Phase 2'));
  });

  it('only wraps auth.uid in a per-statement SELECT while preserving existing policy predicates', () => {
    expect(migration).toContain("replace(v_policy.qual, 'auth.uid()', '(select auth.uid())')");
    expect(migration).toContain("EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)'");
    expect(migration).not.toMatch(/\bdrop\s+policy\b/i);
    expect(migration).not.toMatch(/\bcreate\s+policy\b/i);
    expect(migration).not.toMatch(/\bgrant\s+/i);
    expect(migration).not.toMatch(/\brevoke\s+/i);
    expect(migration).not.toMatch(/\bdisable\s+row\s+level\s+security\b/i);
  });

  it('preserves the organization, chat participation, clean attachment and caller-identity guards', () => {
    expect(migration).toContain("atlas_chat_can_access");
    expect(migration).toContain("organization_members");
    expect(migration).toContain("scan_status");
    expect(migration).toContain("requested_by");
    expect(migration).toContain("om.user_id");
    expect(migration).toContain("om.status");
    expect(migration).toContain("pg_policies");
    expect(migration).toContain("RAISE EXCEPTION");
  });
});
