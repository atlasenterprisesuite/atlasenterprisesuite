import { describe, expect, it } from 'vitest';
import { getSetupSteps, evaluateSetupGate } from '../../apps/web/src/modules/device-os/universalSetupModel';
import { parseSetupDraft, serializeSetupDraft } from '../../apps/web/src/modules/device-os/universalSetupDraft';

describe('ATLAS Universal Setup draft persistence', () => {
  it('stores only allowlisted non-sensitive display preferences', () => {
    const raw = serializeSetupDraft({ language: 'es', step: 2, captions: true, identityVerified: true, token: 'secret' } as never);
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('identityVerified');
    expect(parseSetupDraft(raw)).toEqual({ language: 'es', step: 2, captions: true });
  });
  it('rejects invalid or tampered draft data', () => {
    expect(parseSetupDraft('invalid')).toBeNull();
    expect(parseSetupDraft('{"language":"fr","step":99,"captions":true}')).toBeNull();
  });
  it('keeps migration fail-closed without backend-issued authority', () => {
    expect(evaluateSetupGate({ identityVerified: true, tenantVerified: true, consentGranted: true, adapterAuthorized: false }).allowed).toBe(false);
    expect(getSetupSteps('en')).toHaveLength(8);
  });
});
