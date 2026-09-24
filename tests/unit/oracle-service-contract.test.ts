import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const servicePath = 'supabase/functions/atlas-oracle/index.ts';

describe('ATLAS Oracle service contract', () => {
  it('requires authentication and the private entitlement', () => {
    const source = readFileSync(servicePath, 'utf8');
    expect(source).toContain('authentication_required');
    expect(source).toContain('has_oracle_entitlement');
    expect(source).toContain('oracle_not_entitled');
  });

  it('exposes status, deck, history, detail, create, note and favorite actions', () => {
    const source = readFileSync(servicePath, 'utf8');
    for (const action of ['status', 'deck', 'readings', 'reading', 'create', 'note', 'favorite']) {
      expect(source).toContain(`api === '${action}'`);
    }
  });

  it('uses the caller bearer token instead of a service-role bypass for private data', () => {
    const source = readFileSync(servicePath, 'utf8');
    expect(source).toContain("req.headers.get('authorization')");
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('persists selected cards and rejects an insufficient verified deck', () => {
    const source = readFileSync(servicePath, 'utf8');
    expect(source).toContain('oracle_reading_cards');
    expect(source).toContain('oracle_deck_insufficient');
    expect(source).toContain('crypto.randomUUID()');
  });
});
