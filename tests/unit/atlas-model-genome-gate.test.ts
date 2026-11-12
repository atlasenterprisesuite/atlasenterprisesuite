import { describe, expect, it } from 'vitest';
import {
  selectAtlasModel,
  type AtlasModelCandidate,
  type AtlasModelSelectionRequest
} from '../../packages/ai-core/src/model-genome';

const base: AtlasModelCandidate = {
  providerId: 'openai',
  modelId: 'model-a',
  tenantId: 'tenant-a',
  declaredCapabilities: ['reasoning', 'tool_calling'],
  evidence: {
    evidenceId: 'verified-run-123',
    providerId: 'openai',
    modelId: 'model-a',
    tenantId: 'tenant-a',
    verifiedAt: '2026-11-09T12:00:00.000Z',
    verifiedCapabilities: ['reasoning', 'tool_calling']
  },
  zeroMarginalCostVerified: true,
  estimatedCostUsd: 0
};

function request(overrides: Partial<AtlasModelSelectionRequest> = {}): AtlasModelSelectionRequest {
  return {
    tenantId: 'tenant-a',
    requiredCapabilities: ['reasoning'],
    allowedModelIds: ['model-a'],
    allowPaid: false,
    budgetUsd: 0,
    now: '2026-11-09T13:00:00.000Z',
    candidates: [base],
    ...overrides
  };
}

describe('ATLAS AIR 777 model capability gate', () => {
  it('selects only a fresh, evidence-backed model in the authorized tenant', () => {
    expect(selectAtlasModel(request())).toEqual({
      state: 'ready', providerId: 'openai', modelId: 'model-a',
      evidenceId: 'verified-run-123', reason: 'verified_authorized_model'
    });
  });

  it.each([
    { name: 'missing evidence', candidate: { ...base, evidence: null } },
    { name: 'cross-tenant candidate', candidate: { ...base, tenantId: 'tenant-b' } },
    { name: 'spoofed tenant evidence', candidate: { ...base, evidence: { ...base.evidence!, tenantId: 'tenant-b' } } },
    { name: 'wrong model evidence', candidate: { ...base, evidence: { ...base.evidence!, modelId: 'model-b' } } },
    { name: 'expired evidence', candidate: { ...base, evidence: { ...base.evidence!, verifiedAt: '2026-11-07T12:00:00.000Z' } } },
    { name: 'future evidence', candidate: { ...base, evidence: { ...base.evidence!, verifiedAt: '2026-11-10T12:00:00.000Z' } } },
    { name: 'nonzero cost marked free', candidate: { ...base, estimatedCostUsd: 0.01 } },
    { name: 'unverified cost amount', candidate: { ...base, zeroMarginalCostVerified: false, estimatedCostUsd: null } }
  ])('fails closed for $name', ({ candidate }) => {
    expect(selectAtlasModel(request({ candidates: [candidate] })).state).toBe('blocked');
  });

  it('requires both declared and evidenced task capabilities', () => {
    expect(selectAtlasModel(request({ requiredCapabilities: ['computer_use'] })).state).toBe('blocked');
    expect(selectAtlasModel(request({
      requiredCapabilities: ['reasoning', 'tool_calling'],
      candidates: [{ ...base, evidence: { ...base.evidence!, verifiedCapabilities: ['reasoning'] } }]
    })).state).toBe('blocked');
  });

  it('blocks unallowlisted models and invalid budget or clock', () => {
    expect(selectAtlasModel(request({ allowedModelIds: [] })).state).toBe('blocked');
    expect(selectAtlasModel(request({ budgetUsd: -1 })).reason).toBe('invalid_budget');
    expect(selectAtlasModel(request({ now: 'invalid' })).reason).toBe('invalid_verification_clock');
    expect(selectAtlasModel(request({ requiredCapabilities: [] })).reason).toBe('capabilities_required');
  });

  it('denies paid use by default and enforces explicit budget', () => {
    const paid = { ...base, zeroMarginalCostVerified: false, estimatedCostUsd: 0.05 };
    expect(selectAtlasModel(request({ candidates: [paid] })).state).toBe('blocked');
    expect(selectAtlasModel(request({ candidates: [paid], allowPaid: true, budgetUsd: 0.04 })).state).toBe('blocked');
    expect(selectAtlasModel(request({ candidates: [paid], allowPaid: true, budgetUsd: 0.05 })).state).toBe('ready');
  });

  it('prefers a verified free route over a paid route', () => {
    const paid = {
      ...base, providerId: 'paid',
      evidence: { ...base.evidence!, providerId: 'paid', evidenceId: 'paid-run' },
      zeroMarginalCostVerified: false, estimatedCostUsd: 0.01
    };
    const result = selectAtlasModel(request({ candidates: [paid, base], allowPaid: true, budgetUsd: 1 }));
    expect(result.providerId).toBe('openai');
  });
});
