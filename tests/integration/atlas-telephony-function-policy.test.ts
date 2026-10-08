import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('supabase/config.toml', 'utf8');

describe('ATLAS telephony Edge Function JWT policy under function quota', () => {
  it('keeps the authenticated ATLAS Voice provider behind the JWT gateway', () => {
    expect(config).toContain('[functions.atlas-voice-provider]');
    expect(config).toMatch(/\[functions\.atlas-voice-provider\]\s*\nverify_jwt\s*=\s*true/);
  });

  it('opens only the verification gateway needed for signed Telnyx webhooks', () => {
    expect(config).toContain('[functions.atlas-voice-native-verification]');
    expect(config).toMatch(/\[functions\.atlas-voice-native-verification\]\s*\nverify_jwt\s*=\s*false/);
  });
});
