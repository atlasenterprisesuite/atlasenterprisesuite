import { describe, expect, it } from 'vitest';
import {
  createAuditEvent,
  createStewardshipAuditMetadata
} from '../../packages/core/src';

describe('ATLAS stewardship audit metadata', () => {
  it('whitelists fields and normalizes evidence references', () => {
    const metadata = createStewardshipAuditMetadata({
      purpose: ' payroll.approve ',
      stewardshipRisk: 'R2',
      assurance: 'verified',
      policyDecision: 'allowed',
      evidenceRefs: ['evidence-1', ' ', ' evidence-1 '],
      correlationId: ' req-1 ',
      token: 'must-not-survive'
    } as never);

    expect(metadata).toEqual({
      purpose: 'payroll.approve',
      stewardshipRisk: 'R2',
      assurance: 'verified',
      policyDecision: 'allowed',
      evidenceRefs: ['evidence-1'],
      correlationId: 'req-1'
    });
    expect('token' in metadata).toBe(false);
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.evidenceRefs)).toBe(true);
  });

  it('freezes nested stewardship metadata when creating audit events', () => {
    const event = createAuditEvent({
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      actorId: 'user-1',
      action: 'payroll.approve',
      resource: 'payroll/run-1',
      result: 'success',
      occurredAt: '2026-10-05T05:00:00.000Z',
      stewardship: {
        purpose: 'payroll.approve',
        stewardshipRisk: 'R2',
        assurance: 'verified',
        policyDecision: 'allowed',
        evidenceRefs: ['evidence-1'],
        correlationId: 'req-1'
      }
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.scope)).toBe(true);
    expect(Object.isFrozen(event.stewardship)).toBe(true);
    expect(Object.isFrozen(event.stewardship?.evidenceRefs)).toBe(true);
  });

  it('preserves existing audit events without stewardship metadata', () => {
    const event = createAuditEvent({
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      actorId: 'user-1',
      action: 'accounting.read',
      resource: 'ledger',
      result: 'success',
      occurredAt: '2026-10-05T05:00:00.000Z'
    });

    expect(event.stewardship).toBeUndefined();
    expect(Object.isFrozen(event)).toBe(true);
  });
});
