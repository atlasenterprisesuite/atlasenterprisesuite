import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('tests/fixtures/telephony/atlas-transfer-f4-pg17-isolated.sql', 'utf8');

describe('F4 isolated PostgreSQL transfer fixture contract (static only)', () => {
  it('keeps changes in an isolated schema and exposes no production call issuance', () => {
    expect(sql).toContain('create schema if not exists atlas_transfer_test');
    expect(sql).not.toMatch(/https:\/\/api\.telnyx\.com|\/v1\/live\/sessions\//);
    expect(sql).toContain('no issuance function');
  });
  it('serializes idempotency reservations before insert', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('unique(organization_id,call_session_id,idempotency_key)');
    expect(sql).toContain('for update');
  });
  it('locks membership when verifying active organization and actor', () => {
    expect(sql).toContain("om.user_id=p_actor and om.status='active' for share");
    expect(sql).toContain('s.organization_id=p_org');
    expect(sql).toContain("s.state='connected' for share");
  });
  it('requires tenant-specific allowlisted destination', () => {
    expect(sql).toContain('atlas_transfer_test.allowed_destinations');
    expect(sql).toContain('d.organization_id=p_org and d.destination=p_destination');
  });
  it('denies direct app role execution', () => {
    expect(sql).toContain('revoke all on schema atlas_transfer_test from public,anon,authenticated');
    expect(sql).toContain('from public,anon,authenticated');
  });
});
