import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/atlas-mail-provisioning/index.ts', 'utf8');
const oauth = readFileSync('supabase/functions/_shared/google-oauth.ts', 'utf8');

describe('ATLAS Mail 777 P0 security contracts (red tests)', () => {
  it('fails closed when the audit ledger cannot persist a receipt', () => {
    expect(source).not.toMatch(/if \(!SUPABASE_URL \|\| !SERVICE_ROLE_KEY\) return;/);
    expect(source).not.toMatch(/catch\s*\{\s*\/\/ Provider state is authoritative/);
  });

  it('requires durable idempotency before any Cloudflare alias creation', () => {
    expect(source).toMatch(/idempotency[_-]key|idempotencyKey/i);
    expect(source).toMatch(/lease[_-]id|atomic[_-]claim|SKIP LOCKED/i);
  });

  it('binds provisioning configuration to the authenticated organization', () => {
    expect(source).toMatch(/tenant[_-]config|organization[_-]config|org[_-]mail[_-]config/i);
  });

  it('requires one-time OAuth state consumption beyond signature verification', () => {
    expect(oauth).toMatch(/consume.*nonce|nonce.*consume|replay.*protect/i);
  });
});

describe('ATLAS Mail P0 emergency provider-effect gate', () => {
  it('blocks bulk alias provisioning before provider-side effects while atomic ledger is absent', () => {
    const entry = source.indexOf("if (api === 'bulk-provision' && req.method === 'POST')");
    const gate = source.indexOf("throw new MailError('mail_atomic_claim_and_audit_required', 503)", entry);
    const firstProviderWrite = source.indexOf("const existing = await listRules(cfg)", entry);
    expect(entry).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(entry);
    expect(firstProviderWrite).toBeGreaterThan(gate);
  });
});
