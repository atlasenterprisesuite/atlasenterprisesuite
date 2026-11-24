import { resolveTrustContext } from './_shared/context.ts';
import { trustError, trustErrorResponse } from './_shared/errors.ts';
import { appendTrustRiskEvent, loadTrustPolicy } from './_shared/repository.ts';
import { evaluateTrustRequest } from './_shared/risk.ts';
import type { ActionClass } from '../../../packages/trustpass/src/index.ts';

const ACTION_CLASSES = new Set<ActionClass>(['P0', 'P1', 'P2', 'P3']);
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
  });
}

function safeResourceId(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 512) throw trustError('invalid_action_type', 400);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'invalid_operation' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const operation = typeof body?.operation === 'string' ? body.operation : '';

    if (operation === 'evaluate') {
      const actionType = typeof body?.action_type === 'string' ? body.action_type.trim() : '';
      if (!actionType || actionType.length > 160) throw trustError('invalid_action_type', 400);

      const actionClass = body?.action_class as ActionClass;
      if (!ACTION_CLASSES.has(actionClass)) throw trustError('invalid_action_class', 400);

      const resourceId = safeResourceId(body?.resource_id);
      const context = await resolveTrustContext(req);
      const correlationId = crypto.randomUUID();
      const policy = await loadTrustPolicy(context.admin, context.orgId, actionClass);

      // v1 accepts no browser-supplied risk weights or reason codes. Server-observed
      // signals are added through this boundary as the shadow model expands.
      const evaluation = evaluateTrustRequest({
        actionClass,
        observedAssurance: context.observedAal,
        policy,
        serverReasons: [],
        correlationId
      });

      await appendTrustRiskEvent(context.admin, {
        organization_id: context.orgId,
        user_id: context.userId,
        session_id: context.sessionId,
        action_type: actionType,
        resource_id: resourceId,
        action_class: actionClass,
        risk_score: evaluation.riskScore,
        risk_band: evaluation.riskBand,
        reason_codes: evaluation.reasonCodes,
        policy_id: evaluation.persistedPolicyId,
        policy_version: evaluation.policyVersion,
        decision: evaluation.decision,
        recommended_decision: evaluation.recommendedDecision,
        mode: evaluation.mode,
        correlation_id: correlationId
      });

      return json({
        ok: true,
        decision: evaluation.decision,
        recommended_decision: evaluation.recommendedDecision,
        risk_score: evaluation.riskScore,
        risk_band: evaluation.riskBand,
        reason_codes: evaluation.reasonCodes,
        policy_id: evaluation.policyId,
        policy_version: evaluation.policyVersion,
        correlation_id: correlationId,
        mode: evaluation.mode
      });
    }

    throw trustError('invalid_operation', 400);
  } catch (cause) {
    const response = trustErrorResponse(cause);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
});
