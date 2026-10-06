import { describe, expect, it } from 'vitest';
import {
  authorizeGovernedAction,
  evaluateStewardshipPolicy,
  minimumAssuranceForRisk,
  type AuthorizationContext,
  type StewardshipContext,
  type StewardshipRequirement
} from '../../packages/core/src';

const actor: AuthorizationContext = {
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions: ['accounting.post']
};

const request = {
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permission: 'accounting.post' as const,
  stewardship: { risk: 'R2', minimumAssurance: 'verified' } as StewardshipRequirement
};

const baselineContext: StewardshipContext = {
  actorId: 'user-1',
  actorType: 'human',
  purpose: 'accounting.post',
  assurance: 'baseline',
  evidenceRefs: [],
  correlationId: 'req-1'
};

const verifiedContext: StewardshipContext = {
  ...baselineContext,
  assurance: 'verified',
  evidenceRefs: ['evidence-1']
};

const elevatedContext: StewardshipContext = {
  ...verifiedContext,
  assurance: 'elevated'
};

describe('ATLAS stewardship governance core', () => {
  it('enforces assurance floors by risk', () => {
    expect(minimumAssuranceForRisk('R0')).toBe('baseline');
    expect(minimumAssuranceForRisk('R2')).toBe('verified');
    expect(minimumAssuranceForRisk('R3')).toBe('elevated');
  });

  it('keeps tenant scope authoritative', () => {
    const decision = authorizeGovernedAction(actor, {
      ...request,
      scope: { tenantId: 'tenant-1', organizationId: 'org-2' }
    }, verifiedContext);
    expect(decision.reason).toBe('scope_mismatch');
  });

  it('keeps canonical permission authoritative', () => {
    const decision = authorizeGovernedAction({ ...actor, permissions: [] }, request, elevatedContext);
    expect(decision.reason).toBe('permission_denied');
  });

  it('denies R2 with baseline assurance', () => {
    expect(evaluateStewardshipPolicy(baselineContext, request.stewardship).reason).toBe('assurance_insufficient');
  });

  it('fails closed when evidence is required but missing', () => {
    expect(evaluateStewardshipPolicy({ ...verifiedContext, evidenceRefs: [' ', ''] }, {
      risk: 'R2',
      minimumAssurance: 'verified',
      evidenceRequired: true
    }).reason).toBe('evidence_required');
  });

  it('denies purpose mismatch', () => {
    expect(evaluateStewardshipPolicy({ ...verifiedContext, purpose: 'accounting.read' }, {
      risk: 'R2',
      minimumAssurance: 'verified',
      purpose: 'accounting.post'
    }).reason).toBe('purpose_mismatch');
  });

  it('requires approval when configured', () => {
    expect(evaluateStewardshipPolicy(elevatedContext, {
      risk: 'R3',
      minimumAssurance: 'elevated',
      approvalRequired: true
    }, { approvalGranted: false }).reason).toBe('approval_required');
  });

  it('requires provider verification when configured', () => {
    expect(evaluateStewardshipPolicy(elevatedContext, {
      risk: 'R3',
      minimumAssurance: 'elevated',
      providerRequired: true
    }, { providerVerified: false }).reason).toBe('provider_unverified');
  });

  it('does not let a lower minimumAssurance weaken an R2 floor', () => {
    expect(evaluateStewardshipPolicy(verifiedContext, {
      risk: 'R2',
      minimumAssurance: 'baseline'
    }).allowed).toBe(true);
    expect(evaluateStewardshipPolicy(baselineContext, {
      risk: 'R2',
      minimumAssurance: 'baseline'
    }).reason).toBe('assurance_insufficient');
  });

  it('normalizes blank evidence references before evaluation', () => {
    const decision = evaluateStewardshipPolicy({
      ...verifiedContext,
      evidenceRefs: [' evidence-1 ', ' ', 'evidence-1']
    }, {
      risk: 'R2',
      minimumAssurance: 'verified',
      evidenceRequired: true
    });
    expect(decision.allowed).toBe(true);
    expect(decision.evidenceRefs).toEqual(['evidence-1']);
  });
});
