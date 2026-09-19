import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const client = readFileSync('apps/web/src/modules/voice/realtimeClient.ts', 'utf8');
const voicePage = readFileSync('apps/web/src/modules/voice/AtlasVoicePage.tsx', 'utf8');
const copilot = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');

describe('ATLAS Voice Realtime Phase 2 contract', () => {
  it('keeps provider credentials on the server and creates WebRTC calls through authenticated ATLAS', () => {
    expect(client).toContain('/functions/v1/atlas-copilot?api=realtime-call');
    expect(client).toContain("'content-type': 'application/sdp'");
    expect(client).toContain("'x-atlas-org-id': organization.id");
    expect(client).not.toContain('OPENAI_API_KEY');
    expect(client).not.toContain('api.openai.com');
  });

  it('uses the current OpenAI Realtime call endpoint only from the server boundary', () => {
    expect(copilot).toContain("https://api.openai.com/v1/realtime/calls");
    expect(copilot).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(copilot).toContain("DEFAULT_REALTIME_MODEL='gpt-realtime-2.1'");
    expect(copilot).toContain("ATLAS_REALTIME_ENABLED");
    expect(copilot).toContain("ATLAS_REALTIME_ALLOW_PAID");
    expect(copilot).toContain("tools:[]");
    expect(copilot).toContain("tool_choice:'none'");
  });

  it('fails closed on cost authorization and preserves governed action execution', () => {
    expect(copilot).toContain("realtime_paid_calls_not_approved");
    expect(copilot).toContain("Sensitive, paid, irreversible, financial, payroll, identity, security, or external side effects");
    expect(voicePage).toContain('evaluateVoiceActionProposal');
    expect(voicePage).toContain('navigationVoiceAction');
    expect(voicePage).toContain('sensitive actions route to ATLAS policy and Approval Center');
  });

  it('supports full-duplex interruption and guarded fallback', () => {
    expect(client).toContain("type: 'response.cancel'");
    expect(client).toContain("type: 'output_audio_buffer.clear'");
    expect(voicePage).toContain('Start realtime');
    expect(voicePage).toContain('Start guarded turn');
    expect(voicePage).toContain('Guarded turn mode remains available');
  });
});
