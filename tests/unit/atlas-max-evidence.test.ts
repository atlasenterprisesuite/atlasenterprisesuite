import { describe, expect, it } from 'vitest';
import { deriveEvidenceState, recordUsage } from '../../apps/web/src/services/atlas-max/evidence';
describe('ATLAS MAX evidence', () => {
  it('requires normalized usage identity fields', () => expect(recordUsage({ tenantId:'t', actorId:'u', taskId:'x', providerId:'p', modelId:'m', speedClass:'standard', units:1, timestamp:'now', correlationId:'c', evidenceRef:'e' }).tenantId).toBe('t'));
  it('never turns missing evidence into success', () => expect(deriveEvidenceState(undefined)).toBe('unknown'));
  it('marks failed metering as degraded', () => expect(deriveEvidenceState({ ok:false })).toBe('degraded'));
});