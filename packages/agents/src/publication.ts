import {
  authorize,
  createAuditEvent,
  type AuthorizationContext,
  type AtlasAuditEvent
} from '../../core/src';
import type { AgentVersion } from './types';

function freezePublished(version: AgentVersion): AgentVersion {
  return Object.freeze({
    ...version,
    scope: Object.freeze({ ...version.scope }),
    permissions: Object.freeze([...version.permissions]),
    tools: Object.freeze([...version.tools]),
    safetyRules: Object.freeze([...version.safetyRules]),
    channelInstructions: Object.freeze({ ...version.channelInstructions })
  });
}

export type AgentPublicationResult =
  | { ok: true; version: AgentVersion; audit: AtlasAuditEvent }
  | {
      ok: false;
      reason: 'scope_mismatch' | 'permission_denied' | 'invalid_status';
      audit: AtlasAuditEvent;
    };

export function publishAgentVersion(input: {
  version: AgentVersion;
  actorId: string;
  actor: AuthorizationContext;
  publishedAt: string;
}): AgentPublicationResult {
  const auth = authorize(input.actor, {
    scope: input.version.scope,
    permission: 'agents.publish'
  });

  const baseAudit = {
    scope: input.version.scope,
    actorId: input.actorId,
    action: 'agents.version.published',
    resource: `agent:${input.version.agentId}:version:${input.version.versionId}`,
    occurredAt: input.publishedAt
  };

  if (auth.ok === false) {
    return {
      ok: false,
      reason: auth.reason,
      audit: createAuditEvent({ ...baseAudit, result: 'denied' })
    };
  }

  if (input.version.status !== 'approved') {
    return {
      ok: false,
      reason: 'invalid_status',
      audit: createAuditEvent({ ...baseAudit, result: 'denied' })
    };
  }

  return {
    ok: true,
    version: freezePublished({
      ...input.version,
      status: 'published',
      publishedAt: input.publishedAt
    }),
    audit: createAuditEvent({ ...baseAudit, result: 'success' })
  };
}
