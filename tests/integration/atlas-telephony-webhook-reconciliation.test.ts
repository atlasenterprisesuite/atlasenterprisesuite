import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'supabase/functions/atlas-communication-telephony-webhook/index.ts',
  'utf8'
);

describe('ATLAS Telnyx webhook reconciliation contract', () => {
  it('persists provider evidence before atomically reconciling session state', () => {
    const eventInsert = source.indexOf(".from('atlas_call_events')");
    const stateRpc = source.indexOf(".rpc('atlas_apply_call_provider_state'");
    expect(eventInsert).toBeGreaterThan(-1);
    expect(stateRpc).toBeGreaterThan(eventInsert);
    expect(source).toContain('p_occurred_at: occurredAt');
    expect(source).toContain('p_event_id: eventId');
  });

  it('does not directly write authoritative lifecycle state from webhook arrival order', () => {
    expect(source).not.toContain(".from('atlas_call_sessions')\n      .update(patch)");
  });
});
