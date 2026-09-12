import { expect, it } from 'vitest';
import { createAuditEvent } from '../../packages/core/src';

it('creates scoped metadata-only audit evidence', () => {
  const event = createAuditEvent({
    scope: { tenantId: 't1', organizationId: 'o1' },
    actorId: 'user-1',
    action: 'integration.credentials.changed',
    resource: 'salesforce:primary',
    result: 'success',
    occurredAt: '2026-09-06T18:00:00.000Z',
    evidenceRef: 'provider-check:123'
  });

  expect(event.scope.tenantId).toBe('t1');
  expect(JSON.stringify(event)).not.toContain('secret');
  expect(Object.isFrozen(event)).toBe(true);
  expect(Object.isFrozen(event.scope)).toBe(true);
});
