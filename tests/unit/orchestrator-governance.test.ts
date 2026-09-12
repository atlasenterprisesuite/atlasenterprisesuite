import { describe, expect, it } from 'vitest';
import {
  authorize,
  canHumanApproveRelease,
  redactAuditPayload,
  type AtlasActor
} from '../../packages/governance/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

function actor(overrides: Partial<AtlasActor> = {}): AtlasActor {
  return {
    actorId: 'agent-1',
    kind: 'agent',
    scope,
    permissions: ['ai.task.read'],
    ...overrides
  };
}

describe('ATLAS orchestrator governance', () => {
  it('denies cross-scope access even when permission exists', () => {
    expect(authorize(actor(), 'ai.task.read', { tenantId: 'tenant-b', organizationId: 'org-a' }).allowed).toBe(false);
  });

  it('requires the exact requested permission', () => {
    expect(authorize(actor(), 'ai.task.update', scope).allowed).toBe(false);
    expect(authorize(actor(), 'ai.task.read', scope).allowed).toBe(true);
  });

  it('allows release approval only for an authorized human in the matching scope', () => {
    expect(canHumanApproveRelease(actor({ permissions: ['release.approve'] }), scope, 'awaiting_human_approval')).toBe(false);
    expect(canHumanApproveRelease(actor({ kind: 'human', permissions: ['release.approve'] }), scope, 'awaiting_human_approval')).toBe(true);
    expect(canHumanApproveRelease(actor({ kind: 'human', permissions: ['release.approve'] }), scope, 'ci')).toBe(false);
  });

  it('redacts secret-shaped values recursively', () => {
    expect(redactAuditPayload({
      token: 'secret-token',
      nested: { authorization: 'Bearer abc', safe: 'visible' },
      api_key: 'key'
    })).toEqual({
      token: '[REDACTED]',
      nested: { authorization: '[REDACTED]', safe: 'visible' },
      api_key: '[REDACTED]'
    });
  });
});
