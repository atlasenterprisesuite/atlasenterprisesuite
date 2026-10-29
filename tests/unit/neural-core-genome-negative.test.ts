import { describe, expect, it } from 'vitest';
import { evaluateAdaptation, type AdaptationRequest } from '../../packages/neural-core/src/genome';

const request: AdaptationRequest = {
  pattern: {
    patternId: 'authorization.revocation', version: '1.0.0', owner: 'security',
    capability: 'revoke', compatibleModules: ['advisory'], dependencies: [],
    tenantScope: 'organization', requiredPermissions: ['neural.propose'],
    dataClassification: 'restricted', consentRequired: true,
    negativeTests: ['cross-tenant-denied'], evidenceRefs: ['sha:test']
  },
  targetModule: 'advisory', organizationId: 'org-a', actorId: 'user-a',
  actorPermissions: ['neural.propose'], hasConsent: true
};
describe('Neural Core genome fail-closed proposal gate', () => {
  it('never automatically deploys a valid adaptation', () => {
    expect(evaluateAdaptation(request)).toEqual({ allowed: true, state: 'PROPOSAL_ONLY', patternId: 'authorization.revocation', targetModule: 'advisory' });
  });
  it.each([
    [{ organizationId: null }, 'UNBOUND_IDENTITY'],
    [{ actorId: null }, 'UNBOUND_IDENTITY'],
    [{ targetModule: 'health' }, 'INCOMPATIBLE_MODULE'],
    [{ actorPermissions: [] }, 'MISSING_PERMISSION'],
    [{ hasConsent: false }, 'MISSING_CONSENT'],
    [{ pattern: { ...request.pattern, evidenceRefs: [] } }, 'MISSING_EVIDENCE'],
    [{ pattern: { ...request.pattern, negativeTests: [] } }, 'MISSING_EVIDENCE']
  ] as const)('rejects invalid adaptation %j', (override, reason) => {
    expect(evaluateAdaptation({ ...request, ...override })).toMatchObject({ allowed: false, reason });
  });
});
