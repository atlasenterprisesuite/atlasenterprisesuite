import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('supabase/config.toml', 'utf8');

describe('ATLAS telephony Edge Function JWT policy', () => {
  it('requires ATLAS auth for the interactive telephony API', () => {
    expect(config).toContain('[functions.atlas-communication-telephony]');
    expect(config).toMatch(/\[functions\.atlas-communication-telephony\]\s*\nverify_jwt\s*=\s*true/);
  });

  it('allows provider webhooks through the gateway for Ed25519 verification in-function', () => {
    expect(config).toContain('[functions.atlas-communication-telephony-webhook]');
    expect(config).toMatch(/\[functions\.atlas-communication-telephony-webhook\]\s*\nverify_jwt\s*=\s*false/);
  });
});
