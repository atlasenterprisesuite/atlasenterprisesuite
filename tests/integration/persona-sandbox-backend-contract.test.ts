import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261106091500_atlas_persona_sandbox_proofing.sql','utf8');
const start = readFileSync('supabase/functions/atlas-persona-start/index.ts','utf8');
const webhook = readFileSync('supabase/functions/atlas-persona-webhook/index.ts','utf8');
const config = readFileSync('supabase/config.toml','utf8');

describe('ATLAS Persona Sandbox backend — P0 static source contract', () => {
  it('requires canonical active membership, dedicated identity permission and explicit consent', () => {
    expect(migration).toContain("m.status='active'");
    expect(migration).toContain("p.permission_code='identity.proofing.create'");
    expect(migration).toContain("p.allowed into v_override");
    expect(migration).toContain("p_consent_version is distinct from 'atlas-persona-sandbox-v1'");
    expect(migration).toContain('consent_at timestamptz not null');
    expect(start).toContain(".consent !== true");
    expect(start).toContain("auth.getUser(token)");
    expect(start).toContain("p_consent_version:'atlas-persona-sandbox-v1'");
  });
  it('does not expose proofing tables or write RPCs to anonymous/authenticated clients', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('from public,anon,authenticated');
    expect(migration).toContain('grant select,insert,update on');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('language plpgsql security invoker');
    expect(migration).not.toContain('security definer');
    expect(migration).toContain('tenant_id=organization_id');
  });
  it('rejects cross-org/subject/template mismatches and serializes concurrent requests', () => {
    expect(migration).toContain('atlas_persona_tenant_matches_org');
    expect(migration).toContain('atlas_persona_active_subject');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('subject_user_id=p_actor_user_id');
    expect(migration).toContain('reference_id=p_reference_id and template_id=p_template_id');
    expect(migration).toContain("raise exception 'persona_binding_mismatch'");
  });
  it('applies signed events atomically with unique event id, chronological ordering and audit', () => {
    expect(migration).toContain('provider_event_id text not null unique');
    expect(migration).toContain('on conflict(provider_event_id) do nothing');
    expect(migration).toContain('p_occurred_at <= v_row.last_event_at');
    expect(migration).toContain('for update');
    expect(migration).toContain('insert into public.atlas_persona_audit');
    expect(migration).toContain("raise exception 'persona_inquiry_expired'");
  });
  it('only creates ATLAS-owned sandbox inquiries through server API and pinned Persona version', () => {
    expect(start).toContain("Deno.env.get('PERSONA_MODE') !== 'sandbox'");
    expect(start).toContain("apiKey.startsWith('persona_sandbox_')");
    expect(start).toContain("'Persona-Version':VERSION");
    expect(start).toContain("'Idempotency-Key':reservation.id");
    expect(start).toContain("'reference-id':reservation.reference_id");
    expect(start).toContain("PROVIDER_HOSTS.has(url.hostname)");
    expect(start).toContain("validPersonaUrl(providerResult?.meta?.['one-time-link'])");
    expect(start).toContain("atlas_persona_attach_inquiry");
    expect(start).not.toContain('console.log');
  });
  it('authenticates provider webhook before storage access and rejects unknown identity', () => {
    expect(config).toMatch(/\[functions\.atlas-persona-start\]\s*verify_jwt = true/);
    expect(config).toMatch(/\[functions\.atlas-persona-webhook\]\s*verify_jwt = false/);
    expect(webhook.indexOf('verifyPersonaWebhookSignature')).toBeLessThan(webhook.indexOf(".from('atlas_persona_inquiries')"));
    expect(webhook).toContain("if (!record) return json(409");
    expect(webhook).toContain("resolvePersonaInquiryEvent");
    expect(webhook).toContain("atlas_persona_record_signed_event");
    expect(webhook).not.toContain('console.log');
  });
});
