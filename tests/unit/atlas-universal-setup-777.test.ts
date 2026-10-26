import { describe, expect, it } from 'vitest';
import { getSetupSteps, evaluateSetupGate } from '../../apps/web/src/modules/device-os/universalSetupModel';

describe('ATLAS Universal Setup 777', () => {
  it('provides a guided accessible setup sequence', () => {
    expect(getSetupSteps('es').map(step => step.id)).toEqual(['welcome','language','accessibility','identity','device','migration','security','assistant']);
  });
  it('never authorizes migration without identity, tenant, consent and adapter', () => {
    const baseline = { identityVerified: true, tenantVerified: true, consentGranted: true, adapterAuthorized: true };
    for (const key of Object.keys(baseline) as Array<keyof typeof baseline>) {
      expect(evaluateSetupGate({ ...baseline, [key]: false }).allowed).toBe(false);
    }
    expect(evaluateSetupGate(baseline).allowed).toBe(true);
  });
  it('rejects unsupported locales without silently changing the requested language', () => {
    expect(() => getSetupSteps('fr' as 'es')).toThrow();
  });
});
