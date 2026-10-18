import {
  evaluateStewardshipPolicy,
  minimumAssuranceForRisk
} from '../../../packages/core/src/stewardship.ts';
import { createStewardshipAuditMetadata } from '../../../packages/core/src/audit.ts';

const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const OPERATION_TYPES = new Set(['READ', 'WRITE']);
const STEWARDSHIP_RISKS = new Set(['R0', 'R1', 'R2', 'R3']);
const STEWARDSHIP_ASSURANCE = new Set(['baseline', 'verified', 'elevated']);
const STEWARDSHIP_ACTOR_TYPES = new Set(['human', 'service', 'agent', 'automation', 'provider']);
const RISK_TO_STEWARDSHIP = Object.freeze({
  LOW: 'R0',
  MEDIUM: 'R1',
  HIGH: 'R2',
  CRITICAL: 'R3'
});
const STEWARDSHIP_RISK_ORDER = Object.freeze({ R0: 0, R1: 1, R2: 2, R3: 3 });

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name}_required`);
  return value.trim();
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function permissionsOf(context) {
  return Array.isArray(context?.permissions) ? context.permissions : [];
}

function hasPermission(context, permission) {
  const permissions = permissionsOf(context);
  return permissions.includes('*') || permissions.includes(permission);
}

function createDenied(code, status = 403, details = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

function mappedStewardshipRisk(riskLevel) {
  return RISK_TO_STEWARDSHIP[riskLevel];
}

function normalizeStewardshipConfig(input, riskLevel) {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('invalid_tool_stewardship');
  }

  const mappedRisk = mappedStewardshipRisk(riskLevel);
  const explicitRisk = input.risk === undefined
    ? mappedRisk
    : String(input.risk).trim().toUpperCase();

  if (!STEWARDSHIP_RISKS.has(explicitRisk)) {
    throw new TypeError('invalid_stewardship_risk');
  }
  if (STEWARDSHIP_RISK_ORDER[explicitRisk] < STEWARDSHIP_RISK_ORDER[mappedRisk]) {
    throw new TypeError('stewardship_risk_cannot_lower_tool_risk');
  }

  return Object.freeze({
    purpose: requireText(input.purpose, 'stewardship_purpose'),
    risk: explicitRisk,
    evidenceRequired: Boolean(input.evidenceRequired),
    providerRequired: Boolean(input.providerRequired),
    approvalRequired: Boolean(input.approvalRequired)
  });
}

function fallbackStewardshipContext(context, tool) {
  return Object.freeze({
    actorId: context.agent_id || context.user_id,
    actorType: context.agent_id ? 'agent' : 'human',
    purpose: tool.stewardship.purpose,
    assurance: 'baseline',
    evidenceRefs: Object.freeze([]),
    correlationId: context.request_id,
    providerVerified: false
  });
}

function normalizeTrustedStewardshipContext(resolved, context, tool) {
  const fallback = fallbackStewardshipContext(context, tool);
  if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) return fallback;

  const assurance = STEWARDSHIP_ASSURANCE.has(resolved.assurance)
    ? resolved.assurance
    : 'baseline';
  const actorType = STEWARDSHIP_ACTOR_TYPES.has(resolved.actorType)
    ? resolved.actorType
    : fallback.actorType;
  const actorId = typeof resolved.actorId === 'string' && resolved.actorId.trim()
    ? resolved.actorId.trim()
    : fallback.actorId;
  const purpose = typeof resolved.purpose === 'string' && resolved.purpose.trim()
    ? resolved.purpose.trim()
    : fallback.purpose;
  const evidenceRefs = Object.freeze(
    Array.isArray(resolved.evidenceRefs)
      ? [...new Set(resolved.evidenceRefs.map(value => String(value).trim()).filter(Boolean))]
      : []
  );
  const correlationId = typeof resolved.correlationId === 'string' && resolved.correlationId.trim()
    ? resolved.correlationId.trim()
    : fallback.correlationId;

  return Object.freeze({
    actorId,
    actorType,
    purpose,
    assurance,
    evidenceRefs,
    correlationId,
    providerVerified: resolved.providerVerified === true
  });
}

function stewardshipRequirement(tool) {
  return {
    risk: tool.stewardship.risk,
    minimumAssurance: minimumAssuranceForRisk(tool.stewardship.risk),
    purpose: tool.stewardship.purpose,
    evidenceRequired: tool.stewardship.evidenceRequired,
    providerRequired: tool.stewardship.providerRequired
  };
}

function stewardshipAuditMetadata(decision) {
  return createStewardshipAuditMetadata({
    purpose: decision.purpose,
    stewardshipRisk: decision.risk,
    assurance: decision.assurance,
    policyDecision: decision.reason,
    evidenceRefs: decision.evidenceRefs,
    correlationId: decision.correlationId
  });
}

export function validateAgentContext(context = {}) {
  const errors = [];
  if (typeof context.organization_id !== 'string' || !context.organization_id.trim()) errors.push('organization_id_required');
  if (typeof context.user_id !== 'string' || !context.user_id.trim()) errors.push('user_id_required');
  if (!Array.isArray(context.permissions)) errors.push('permissions_required');
  if (typeof context.session_id !== 'string' || !context.session_id.trim()) errors.push('session_id_required');
  if (typeof context.request_id !== 'string' || !context.request_id.trim()) errors.push('request_id_required');
  return { ok: errors.length === 0, errors };
}

export function normalizeAgentContext(context = {}) {
  const validation = validateAgentContext(context);
  if (!validation.ok) {
    throw createDenied(`invalid_agent_context:${validation.errors.join(',')}`, 400, { errors: validation.errors });
  }
  return Object.freeze({
    organization_id: context.organization_id.trim(),
    user_id: context.user_id.trim(),
    permissions: [...new Set(context.permissions.map(String))],
    roles: Array.isArray(context.roles) ? [...new Set(context.roles.map(String))] : [],
    session_id: context.session_id.trim(),
    request_id: context.request_id.trim(),
    actor_type: 'human',
    ...(context.agent_id ? { agent_id: String(context.agent_id) } : {}),
    ...(context.channel ? { channel: String(context.channel) } : {})
  });
}

export class AtlasToolRegistry {
  #tools = new Map();

  register(tool = {}) {
    const name = requireText(tool.name, 'tool_name');
    const module = requireText(tool.module, 'tool_module');
    const operation = requireText(tool.operation, 'tool_operation').toUpperCase();
    const risk_level = requireText(tool.risk_level || 'LOW', 'tool_risk_level').toUpperCase();

    if (!OPERATION_TYPES.has(operation)) throw new TypeError('invalid_tool_operation');
    if (!RISK_LEVELS.has(risk_level)) throw new TypeError('invalid_tool_risk_level');
    if (typeof tool.handler !== 'function') throw new TypeError('tool_handler_required');
    if (this.#tools.has(name)) {
      throw Object.assign(new Error('tool_already_registered'), {
        code: 'tool_already_registered',
        status: 409,
        name
      });
    }

    const stewardship = normalizeStewardshipConfig(tool.stewardship, risk_level);
    const requires_approval = Boolean(
      tool.requires_approval ||
      risk_level === 'HIGH' ||
      risk_level === 'CRITICAL' ||
      stewardship?.approvalRequired ||
      stewardship?.risk === 'R3'
    );
    const normalized = Object.freeze({
      name,
      module,
      operation,
      risk_level,
      description: String(tool.description || ''),
      permission: requireText(tool.permission, 'tool_permission'),
      requires_approval,
      input_schema: clone(tool.input_schema || { type: 'object' }),
      ...(stewardship ? { stewardship } : {}),
      handler: tool.handler
    });

    this.#tools.set(name, normalized);
    return { ...normalized, handler: undefined };
  }

  get(name) {
    return this.#tools.get(name) || null;
  }

  list() {
    return [...this.#tools.values()].map(tool => ({ ...tool, handler: undefined }));
  }
}

export class AtlasAgentPolicyGateway {
  evaluate({ context, tool, arguments: args = {} } = {}) {
    const normalized = normalizeAgentContext(context);
    if (!tool) return { allowed: false, reason: 'tool_not_found', context: normalized };
    if (!hasPermission(normalized, tool.permission)) {
      return { allowed: false, reason: 'permission_denied', context: normalized };
    }
    if (
      args &&
      typeof args === 'object' &&
      'organization_id' in args &&
      args.organization_id !== normalized.organization_id
    ) {
      return { allowed: false, reason: 'tenant_mismatch', context: normalized };
    }
    return { allowed: true, reason: 'allowed', context: normalized };
  }
}

export class AtlasAgenticDispatcher {
  #registry;
  #policy;
  #approvals;
  #audit;
  #resolveStewardshipContext;

  constructor({ registry, policy, approvals, audit, resolveStewardshipContext } = {}) {
    if (!registry) throw new TypeError('registry_required');
    if (!policy) throw new TypeError('policy_required');
    if (!audit) throw new TypeError('audit_required');
    this.#registry = registry;
    this.#policy = policy;
    this.#approvals = approvals;
    this.#audit = audit;
    this.#resolveStewardshipContext = typeof resolveStewardshipContext === 'function'
      ? resolveStewardshipContext
      : null;
  }

  async execute({ context, tool_name, arguments: args = {}, approval_id = null } = {}) {
    const tool = this.#registry.get(tool_name);
    const evaluation = this.#policy.evaluate({ context, tool, arguments: args });
    const normalized = evaluation.context;
    const baseAudit = {
      context: normalized,
      target_type: 'agent_tool',
      target_id: String(tool_name || 'unknown')
    };

    if (!evaluation.allowed) {
      this.#audit.append({
        ...baseAudit,
        action: 'agent.tool.rejected',
        details: { request_id: normalized.request_id, reason: evaluation.reason }
      });
      throw createDenied(evaluation.reason, 403, { tool_name });
    }

    let stewardshipDecision = null;
    let stewardshipMetadata = null;
    if (tool.stewardship) {
      let resolved = null;
      if (this.#resolveStewardshipContext) {
        try {
          resolved = await this.#resolveStewardshipContext({
            context: normalized,
            tool: { ...tool, handler: undefined },
            arguments: clone(args)
          });
        } catch {
          resolved = null;
        }
      }

      const trustedContext = normalizeTrustedStewardshipContext(resolved, normalized, tool);
      stewardshipDecision = evaluateStewardshipPolicy(
        trustedContext,
        stewardshipRequirement(tool),
        { providerVerified: trustedContext.providerVerified }
      );
      stewardshipMetadata = stewardshipAuditMetadata(stewardshipDecision);

      if (!stewardshipDecision.allowed) {
        this.#audit.append({
          ...baseAudit,
          action: 'agent.tool.rejected',
          details: {
            request_id: normalized.request_id,
            reason: stewardshipDecision.reason,
            stewardship: stewardshipMetadata
          }
        });
        throw createDenied(stewardshipDecision.reason, 403, { tool_name });
      }
    }

    if (tool.requires_approval) {
      if (!this.#approvals) throw createDenied('approval_service_unavailable', 503, { tool_name });
      if (!approval_id) {
        this.#audit.append({
          ...baseAudit,
          action: 'agent.tool.awaiting_approval',
          details: {
            request_id: normalized.request_id,
            risk_level: tool.risk_level,
            ...(stewardshipMetadata ? { stewardship: stewardshipMetadata } : {})
          }
        });
        throw createDenied('approval_required', 409, { tool_name });
      }
      const approvals = this.#approvals.list({ context: normalized });
      const approval = approvals.find(item =>
        item.id === approval_id &&
        item.status === 'approved' &&
        item.subject_type === 'agent_tool' &&
        item.subject_id === tool.name
      );
      if (!approval) {
        this.#audit.append({
          ...baseAudit,
          action: 'agent.tool.rejected',
          details: {
            request_id: normalized.request_id,
            reason: 'approval_invalid',
            ...(stewardshipMetadata ? { stewardship: stewardshipMetadata } : {})
          }
        });
        throw createDenied('approval_invalid', 403, { tool_name });
      }
    }

    this.#audit.append({
      ...baseAudit,
      action: 'agent.tool.authorized',
      details: {
        request_id: normalized.request_id,
        module: tool.module,
        operation: tool.operation,
        risk_level: tool.risk_level,
        ...(stewardshipMetadata ? { stewardship: stewardshipMetadata } : {})
      }
    });

    try {
      const result = await tool.handler({ context: normalized, arguments: clone(args) });
      this.#audit.append({
        ...baseAudit,
        action: 'agent.tool.succeeded',
        details: {
          request_id: normalized.request_id,
          module: tool.module,
          ...(stewardshipMetadata ? { stewardship: stewardshipMetadata } : {})
        }
      });
      return result;
    } catch (error) {
      this.#audit.append({
        ...baseAudit,
        action: 'agent.tool.failed',
        details: {
          request_id: normalized.request_id,
          module: tool.module,
          error_code: error?.code || 'execution_failed',
          ...(stewardshipMetadata ? { stewardship: stewardshipMetadata } : {})
        }
      });
      throw error;
    }
  }
}

export function createAtlasAgenticCore({ approvals, audit, resolveStewardshipContext } = {}) {
  const registry = new AtlasToolRegistry();
  const policy = new AtlasAgentPolicyGateway();
  const dispatcher = new AtlasAgenticDispatcher({
    registry,
    policy,
    approvals,
    audit,
    resolveStewardshipContext
  });
  return { registry, policy, dispatcher };
}

export const agenticCoreContract = Object.freeze({
  service: 'ATLAS Intelligence & Agentic Core',
  issue: 434,
  providerNeutral: true,
  directDatabaseAccess: false,
  governedToolExecution: true,
  tenantBoundary: 'organization_id',
  humanPrincipal: 'user_id'
});
