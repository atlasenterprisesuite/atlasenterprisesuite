import type { ExecutionScope } from '../../../../packages/execution/src/types';

/**
 * Restricted server-side API-v2 task envelope.
 *
 * This is a pure plan only: NO fetch, credentials, OAuth grant, network
 * request, queue publication, or third-party task execution occurs here.
 * All policy inputs must come from the authenticated ATLAS server boundary.
 */
export type ManusV2DispatchInput = {
  requestId: string;
  taskId: string;
  idempotencyKey: string;
  actorScope: ExecutionScope;
  taskScope: ExecutionScope;
  sourceSha: string;
  approvedSha: string;
  prompt: string;
  requestedCapabilities: readonly string[];
  grantedCapabilities: readonly string[];
  grantedPermissions: readonly string[];
  approved: boolean;
  providerEnabled: boolean;
  budgetApproved: boolean;
  durableClaimVerified: boolean;
  /** Deliberately opt-in; MUST be false until provider and security gates pass. */
  executionEnabled?: boolean;
};

export type ManusV2RequestBody = {
  message: { content: readonly [{ type: 'text'; text: string; visibility: 'visible' }] };
  clear_connectors: true;
  share_visibility: 'private';
  interactive_mode: true;
  agent_profile: 'lite';
};

export type ManusV2DispatchDecision =
  | { state: 'blocked'; reason: string }
  | {
      state: 'ready';
      url: 'https://api.manus.ai/v2/task.create';
      method: 'POST';
      body: ManusV2RequestBody;
      taskId: string;
      requestId: string;
      idempotencyKey: string;
      scope: ExecutionScope;
      sourceSha: string;
    };

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const SHA_40 = /^[a-f0-9]{40}$/;
const MANUS_URL = 'https://api.manus.ai/v2/task.create' as const;

/**
 * `clear_connectors: true` is mandatory. Omitting it silently inherits the
 * Manus account's default connectors, even with message.connectors: [].
 * Manus may still offer separate built-in tools; this function is not a
 * complete sandbox. Only approve work once provider-side policy is verified.
 */
export function prepareManusV2Dispatch(input: ManusV2DispatchInput): ManusV2DispatchDecision {
  const block = (reason: string): ManusV2DispatchDecision => ({ state: 'blocked', reason });
  if (!input || input.executionEnabled !== true) return block('external_execution_disabled');

  if (!input.actorScope || !input.taskScope
    || typeof input.actorScope.tenantId !== 'string'
    || typeof input.actorScope.organizationId !== 'string'
    || !SAFE_ID.test(input.actorScope.tenantId)
    || !SAFE_ID.test(input.actorScope.organizationId)
    || typeof input.taskScope.tenantId !== 'string'
    || typeof input.taskScope.organizationId !== 'string'
    || !SAFE_ID.test(input.taskScope.tenantId)
    || !SAFE_ID.test(input.taskScope.organizationId)) return block('scope_invalid');

  if (input.actorScope.tenantId !== input.taskScope.tenantId
    || input.actorScope.organizationId !== input.taskScope.organizationId) {
    return block('scope_mismatch');
  }
  if (typeof input.sourceSha !== 'string'
    || !SHA_40.test(input.sourceSha)
    || input.sourceSha !== input.approvedSha) return block('sha_not_approved');

  if (input.approved !== true || input.providerEnabled !== true
    || input.budgetApproved !== true || input.durableClaimVerified !== true
    || !Array.isArray(input.grantedPermissions)
    || !input.grantedPermissions.includes('execution.delegate.manus')) return block('policy_not_authorized');

  if (!Array.isArray(input.requestedCapabilities)
    || input.requestedCapabilities.length !== 1
    || input.requestedCapabilities[0] !== 'research.readonly'
    || !Array.isArray(input.grantedCapabilities)
    || !input.grantedCapabilities.includes('research.readonly')) return block('capability_not_allowed');

  if (typeof input.requestId !== 'string' || !SAFE_ID.test(input.requestId)
    || typeof input.taskId !== 'string' || !SAFE_ID.test(input.taskId)
    || typeof input.idempotencyKey !== 'string' || !SAFE_ID.test(input.idempotencyKey)
    || typeof input.prompt !== 'string'
    || input.prompt.trim().length === 0
    || input.prompt.length > 4096
    || /[\u0000-\u001f\u007f]/.test(input.prompt)) return block('invalid_task_payload');

  return {
    state: 'ready',
    url: MANUS_URL,
    method: 'POST',
    body: {
      message: { content: [{ type: 'text', text: input.prompt, visibility: 'visible' }] },
      clear_connectors: true,
      share_visibility: 'private',
      interactive_mode: true,
      agent_profile: 'lite'
    },
    taskId: input.taskId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    scope: {
      tenantId: input.actorScope.tenantId,
      organizationId: input.actorScope.organizationId
    },
    sourceSha: input.sourceSha
  };
}
