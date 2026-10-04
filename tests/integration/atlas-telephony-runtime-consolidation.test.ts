import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const provider = readFileSync('supabase/functions/atlas-voice-provider/index.ts', 'utf8');
const nativeVerification = readFileSync('supabase/functions/atlas-voice-native-verification/index.ts', 'utf8');
const api = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');

describe('ATLAS quota-safe Telnyx runtime consolidation', () => {
  it('routes authenticated telephony operations through atlas-voice-provider', () => {
    expect(provider).toContain("api === 'telephony-readiness'");
    expect(provider).toContain("api === 'telephony-call'");
    expect(provider).toContain("communication.telephony.read");
    expect(provider).toContain("communication.telephony.call");
    expect(api).toContain('/functions/v1/atlas-voice-provider?api=telephony-readiness');
    expect(api).toContain('/functions/v1/atlas-voice-provider?api=telephony-call');
  });

  it('routes provider webhooks through the verification gateway and verifies Telnyx signatures', () => {
    expect(nativeVerification).toContain("api === 'telnyx-webhook'");
    expect(nativeVerification).toContain('verifyTelnyxWebhook');
    expect(nativeVerification).toContain('atlas_apply_call_provider_state');
  });
});
