import { describe, expect, it } from 'vitest';
import { analyzeSignal } from '../../packages/telecom/signal-intelligence';

const context = { actorId: 'actor-1', organizationId: 'org-a', permissions: ['signal.analyze'], authorizedOrganizations: ['org-a'] };
const input = { organizationId: 'org-a', number: '+1 250 524 0575', message: 'hello' };
describe('signal-intelligence additional negative contract (red tests)', () => {
  it('rejects spoofed provider evidence even when booleans claim verification', () => {
    const result = analyzeSignal({ ...input, providerEvidence: { source: 'forged', reference: 'forged', observedAt: new Date().toISOString(), authenticated: true, authoritative: true, carrier: 'Untrusted' } }, context);
    expect(result.providerStatus).toBe('not_connected');
    expect(result.providerEvidence).toBeNull();
  });
  it('rejects malformed NANP area and exchange codes', () => {
    expect(() => analyzeSignal({ ...input, number: '+1 200 024 0575' }, context)).toThrow('invalid_nanp_number');
  });
  it('rejects empty SMS or explicit absent consent', () => {
    expect(() => analyzeSignal({ ...input, message: '' }, context)).toThrow();
  });
});
