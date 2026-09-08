import {
  sameScope,
  type AuditSink,
  type TenantScope,
} from '../../core/src';

export type AutomationPermission =
  | 'automation.read'
  | 'automation.create'
  | 'automation.update'
  | 'automation.delete'
  | 'automation.manage'
  | 'automation.execute'
  | 'automation.audit'
  | 'automation.admin';

export type AutomationActor = TenantScope & {
  userId: string;
  permissions: readonly AutomationPermission[];
};

export type TriggerType = 'manual' | 'schedule' | 'module.event' | 'network.event';
export type ConditionType = 'equals' | 'notEquals' | 'in' | 'exists';
export type AutomationExecutionStatus = 'success' | 'failed' | 'skipped' | 'denied';

export type ShortcutTrigger = {
  type: TriggerType;
  config: Record<string, unknown>;
};

export type ShortcutCondition = {
  type: ConditionType;
  path: string;
  value?: unknown;
};

export type ShortcutAction = {
  type: string;
  input: Record<string, unknown>;
  required: boolean;
};

export type ShortcutDefinition = TenantScope & {
  id: string;
  name: string;
  description: string;
  trigger: ShortcutTrigger;
  conditions: ShortcutCondition[];
  actions: ShortcutAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ShortcutDefinitionInput = TenantScope & {
  id?: string;
  name: string;
  description?: string;
  trigger: ShortcutTrigger;
  conditions?: ShortcutCondition[];
  actions: Array<Omit<ShortcutAction, 'required'> & { required?: boolean }>;
  enabled?: boolean;
  createdBy: string;
  createdAt?: string;
};

export type AutomationEvent = {
  type: TriggerType;
  name?: string;
  scheduleId?: string;
  payload?: Record<string, unknown>;
};

export type ActionResult = {
  type: string;
  status: 'success' | 'failed' | 'unavailable';
  output?: unknown;
  errorCode?: AutomationErrorCode;
};

export type AutomationExecutionRecord = TenantScope & {
  executionId: string;
  shortcutId: string;
  actorUserId: string;
  triggerType: TriggerType | null;
  status: AutomationExecutionStatus;
  errorCode?: AutomationErrorCode;
  startedAt: string;
  finishedAt: string;
  actionResults: ActionResult[];
};

export type AutomationErrorCode =
  | 'INVALID_SHORTCUT'
  | 'DUPLICATE_ACTION_TYPE'
  | 'ACTION_UNAVAILABLE'
  | 'ACTION_FAILED'
  | 'SHORTCUT_DISABLED'
  | 'TRIGGER_MISMATCH'
  | 'CONDITIONS_UNMET'
  | 'SCOPE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'SHORTCUT_NOT_FOUND';

export class AutomationError extends Error {
  constructor(
    public readonly code: AutomationErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(`${code}: ${message}`);
    this.name = 'AutomationError';
  }
}

const TRIGGER_TYPES = new Set<TriggerType>(['manual', 'schedule', 'module.event', 'network.event']);
const CONDITION_TYPES = new Set<ConditionType>(['equals', 'notEquals', 'in', 'exists']);
const FORBIDDEN_KEYS = new Set([
  'command',
  'shell',
  'script',
  'eval',
  'function',
  'dynamicimport',
  '__proto__',
  'prototype',
  'constructor',
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function invalid(message: string, details?: unknown): never {
  throw new AutomationError('INVALID_SHORTCUT', message, details);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalid(`${label} is required`);
  return value.trim();
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertDeclarative(value: unknown, path = 'payload'): void {
  if (typeof value === 'function') invalid('Executable values are not allowed', { path });
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDeclarative(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      invalid(`Executable or unsafe key is not allowed: ${key}`, { path: `${path}.${key}` });
    }
    assertDeclarative(child, `${path}.${key}`);
  }
}

function normalizeTrigger(triggerInput: ShortcutTrigger): ShortcutTrigger {
  const trigger = requireObject(triggerInput, 'Trigger');
  const type = requireText(trigger.type, 'Trigger type') as TriggerType;
  if (!TRIGGER_TYPES.has(type)) invalid(`Unsupported trigger type: ${type}`);
  const config = trigger.config == null ? {} : requireObject(trigger.config, 'Trigger config');
  assertDeclarative(config, 'trigger.config');
  if (type === 'module.event' || type === 'network.event') {
    const event = requireText(config.event, 'Event name');
    if (!event.includes('.')) invalid('Event name must be namespaced');
  }
  if (type === 'schedule' && config.scheduleId != null) requireText(config.scheduleId, 'Schedule ID');
  return { type, config: clone(config) };
}

function normalizeConditions(conditions: ShortcutCondition[] = []): ShortcutCondition[] {
  if (!Array.isArray(conditions)) invalid('Conditions must be an array');
  return conditions.map((condition, index) => {
    const record = requireObject(condition, `Condition ${index}`);
    const type = requireText(record.type, `Condition ${index} type`) as ConditionType;
    if (!CONDITION_TYPES.has(type)) invalid(`Unsupported condition type: ${type}`);
    const path = requireText(record.path, `Condition ${index} path`);
    if (type === 'in' && !Array.isArray(record.value)) invalid('Condition value for in must be an array');
    assertDeclarative(record.value, `conditions[${index}].value`);
    return type === 'exists'
      ? { type, path }
      : { type, path, value: clone(record.value) };
  });
}

function normalizeActions(
  actions: Array<Omit<ShortcutAction, 'required'> & { required?: boolean }>,
): ShortcutAction[] {
  if (!Array.isArray(actions) || actions.length === 0) invalid('At least one action is required');
  return actions.map((action, index) => {
    const record = requireObject(action, `Action ${index}`);
    const type = requireText(record.type, `Action ${index} type`);
    const input = record.input == null ? {} : requireObject(record.input, `Action ${index} input`);
    assertDeclarative(input, `actions[${index}].input`);
    if (record.required != null && typeof record.required !== 'boolean') {
      invalid(`Action ${index} required must be boolean`);
    }
    return { type, input: clone(input), required: record.required !== false };
  });
}

export function createShortcutDefinition(
  input: ShortcutDefinitionInput,
  options: {
    now?: () => string;
    id?: () => string;
  } = {},
): ShortcutDefinition {
  requireObject(input, 'Shortcut');
  const tenantId = requireText(input.tenantId, 'Tenant ID');
  const organizationId = requireText(input.organizationId, 'Organization ID');
  const name = requireText(input.name, 'Name');
  const createdBy = requireText(input.createdBy, 'Created by');
  if (input.description != null && typeof input.description !== 'string') invalid('Description must be a string');
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => `shortcut-${crypto.randomUUID()}`);
  const timestamp = now();
  return {
    tenantId,
    organizationId,
    id: input.id ? requireText(input.id, 'Shortcut ID') : id(),
    name,
    description: input.description?.trim() ?? '',
    trigger: normalizeTrigger(input.trigger),
    conditions: normalizeConditions(input.conditions ?? []),
    actions: normalizeActions(input.actions),
    enabled: input.enabled ?? false,
    createdBy,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export type ActionExecutionContext = {
  scope: TenantScope;
  actor: AutomationActor;
  shortcut: ShortcutDefinition;
  input: Record<string, unknown>;
  services: Readonly<Record<string, unknown>>;
};

export type ActionAdapter = (context: ActionExecutionContext) => unknown | Promise<unknown>;

export class ActionRegistry {
  private readonly adapters = new Map<string, ActionAdapter>();

  register(typeInput: string, adapter: ActionAdapter): string {
    const type = requireText(typeInput, 'Action type');
    if (typeof adapter !== 'function') throw new TypeError('Action adapter must be a function');
    if (this.adapters.has(type)) {
      throw new AutomationError('DUPLICATE_ACTION_TYPE', `Action type already registered: ${type}`);
    }
    this.adapters.set(type, adapter);
    return type;
  }

  has(typeInput: string): boolean {
    return this.adapters.has(requireText(typeInput, 'Action type'));
  }

  async execute(typeInput: string, context: ActionExecutionContext): Promise<ActionResult> {
    const type = requireText(typeInput, 'Action type');
    const adapter = this.adapters.get(type);
    if (!adapter) return { type, status: 'unavailable', errorCode: 'ACTION_UNAVAILABLE' };
    try {
      const output = await adapter({ ...context, input: clone(context.input) });
      return { type, status: 'success', output: clone(output) };
    } catch {
      return { type, status: 'failed', errorCode: 'ACTION_FAILED' };
    }
  }
}

function getPath(root: unknown, path: string): { exists: boolean; value: unknown } {
  const parts = path.split('.').filter(Boolean);
  let value: unknown = root;
  for (const part of parts) {
    if (
      value == null ||
      typeof value !== 'object' ||
      !Object.prototype.hasOwnProperty.call(value, part)
    ) {
      return { exists: false, value: undefined };
    }
    value = (value as Record<string, unknown>)[part];
  }
  return { exists: true, value };
}

function conditionPasses(condition: ShortcutCondition, context: unknown): boolean {
  const resolved = getPath(context, condition.path);
  if (condition.type === 'exists') return resolved.exists;
  if (!resolved.exists) return false;
  if (condition.type === 'equals') return Object.is(resolved.value, condition.value);
  if (condition.type === 'notEquals') return !Object.is(resolved.value, condition.value);
  if (condition.type === 'in') {
    return Array.isArray(condition.value) && condition.value.some((entry) => Object.is(entry, resolved.value));
  }
  return false;
}

function triggerMatches(trigger: ShortcutTrigger, event: AutomationEvent | undefined): boolean {
  if (!event || event.type !== trigger.type) return false;
  if (trigger.type === 'module.event' || trigger.type === 'network.event') {
    return trigger.config.event ? event.name === trigger.config.event : true;
  }
  if (trigger.type === 'schedule') {
    return trigger.config.scheduleId ? event.scheduleId === trigger.config.scheduleId : true;
  }
  return trigger.type === 'manual';
}

export class AutomationEngine {
  constructor(
    private readonly registry: ActionRegistry,
    private readonly options: {
      now?: () => string;
      id?: () => string;
    } = {},
  ) {}

  async execute(input: {
    shortcut: ShortcutDefinition;
    event?: AutomationEvent;
    actor: AutomationActor;
    services?: Readonly<Record<string, unknown>>;
  }): Promise<AutomationExecutionRecord> {
    const now = this.options.now ?? (() => new Date().toISOString());
    const id = this.options.id ?? (() => `execution-${crypto.randomUUID()}`);
    const startedAt = now();
    const base: Omit<AutomationExecutionRecord, 'status' | 'finishedAt' | 'actionResults'> = {
      executionId: id(),
      shortcutId: input.shortcut.id,
      tenantId: input.shortcut.tenantId,
      organizationId: input.shortcut.organizationId,
      actorUserId: input.actor.userId,
      triggerType: input.event?.type ?? input.shortcut.trigger.type ?? null,
      startedAt,
    };
    const finish = (
      status: AutomationExecutionStatus,
      errorCode?: AutomationErrorCode,
      actionResults: ActionResult[] = [],
    ): AutomationExecutionRecord => ({
      ...base,
      status,
      ...(errorCode ? { errorCode } : {}),
      finishedAt: now(),
      actionResults,
    });

    if (!sameScope(input.shortcut, input.actor)) return finish('denied', 'SCOPE_MISMATCH');
    if (!input.shortcut.enabled) return finish('skipped', 'SHORTCUT_DISABLED');
    if (!triggerMatches(input.shortcut.trigger, input.event)) return finish('skipped', 'TRIGGER_MISMATCH');

    const conditionContext = { event: input.event, actor: input.actor, shortcut: input.shortcut };
    if (!input.shortcut.conditions.every((condition) => conditionPasses(condition, conditionContext))) {
      return finish('skipped', 'CONDITIONS_UNMET');
    }

    const actionResults: ActionResult[] = [];
    for (const action of input.shortcut.actions) {
      const result = await this.registry.execute(action.type, {
        scope: { tenantId: input.shortcut.tenantId, organizationId: input.shortcut.organizationId },
        actor: input.actor,
        shortcut: input.shortcut,
        input: action.input,
        services: input.services ?? {},
      });
      actionResults.push(result);
      if ((result.status === 'failed' || result.status === 'unavailable') && action.required) {
        return finish('failed', result.errorCode, actionResults);
      }
    }

    return finish('success', undefined, actionResults);
  }
}

function scopeKey(scope: TenantScope): string {
  return `${scope.tenantId}\u0000${scope.organizationId}`;
}

export class InMemoryAutomationStore {
  private readonly shortcuts = new Map<string, Map<string, ShortcutDefinition>>();
  private readonly executions = new Map<string, Map<string, AutomationExecutionRecord>>();

  private bucket<T>(root: Map<string, Map<string, T>>, scope: TenantScope): Map<string, T> {
    const key = scopeKey(scope);
    let bucket = root.get(key);
    if (!bucket) {
      bucket = new Map<string, T>();
      root.set(key, bucket);
    }
    return bucket;
  }

  createShortcut(scope: TenantScope, shortcut: ShortcutDefinition): ShortcutDefinition {
    if (!sameScope(scope, shortcut)) throw new AutomationError('SCOPE_MISMATCH', 'Shortcut scope mismatch');
    this.bucket(this.shortcuts, scope).set(shortcut.id, clone(shortcut));
    return clone(shortcut);
  }

  getShortcut(scope: TenantScope, shortcutId: string): ShortcutDefinition | null {
    return clone(this.shortcuts.get(scopeKey(scope))?.get(shortcutId) ?? null);
  }

  listShortcuts(scope: TenantScope): ShortcutDefinition[] {
    return [...(this.shortcuts.get(scopeKey(scope))?.values() ?? [])].map(clone);
  }

  updateShortcut(scope: TenantScope, shortcutId: string, next: ShortcutDefinition): ShortcutDefinition | null {
    if (!sameScope(scope, next)) throw new AutomationError('SCOPE_MISMATCH', 'Shortcut scope mismatch');
    const bucket = this.shortcuts.get(scopeKey(scope));
    if (!bucket?.has(shortcutId)) return null;
    bucket.set(shortcutId, clone(next));
    return clone(next);
  }

  deleteShortcut(scope: TenantScope, shortcutId: string): ShortcutDefinition | null {
    const bucket = this.shortcuts.get(scopeKey(scope));
    const current = bucket?.get(shortcutId);
    if (!current) return null;
    bucket?.delete(shortcutId);
    return clone(current);
  }

  saveExecution(scope: TenantScope, execution: AutomationExecutionRecord): AutomationExecutionRecord {
    if (!sameScope(scope, execution)) throw new AutomationError('SCOPE_MISMATCH', 'Execution scope mismatch');
    this.bucket(this.executions, scope).set(execution.executionId, clone(execution));
    return clone(execution);
  }

  listExecutions(scope: TenantScope): AutomationExecutionRecord[] {
    return [...(this.executions.get(scopeKey(scope))?.values() ?? [])].map(clone);
  }
}

export function hasAutomationPermission(actor: AutomationActor, required: AutomationPermission): boolean {
  return actor.permissions.includes('automation.admin') || actor.permissions.includes(required);
}

function requirePermission(actor: AutomationActor, required: AutomationPermission): void {
  if (!hasAutomationPermission(actor, required)) {
    throw new AutomationError('PERMISSION_DENIED', `Missing permission: ${required}`);
  }
}

export class AutomationService {
  constructor(
    private readonly store: InMemoryAutomationStore,
    private readonly engine: AutomationEngine,
    private readonly audit: AuditSink,
    private readonly options: {
      now?: () => string;
      shortcutId?: () => string;
      auditId?: () => string;
      correlationId?: () => string;
    } = {},
  ) {}

  private now(): string {
    return (this.options.now ?? (() => new Date().toISOString()))();
  }

  private appendAudit(
    actor: AutomationActor,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): void {
    this.audit.append({
      id: (this.options.auditId ?? (() => `audit-${crypto.randomUUID()}`))(),
      tenantId: actor.tenantId,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action,
      entityType: 'automation.shortcut',
      entityId,
      before: clone(before),
      after: clone(after),
      timestamp: this.now(),
      correlationId: (this.options.correlationId ?? (() => `corr-${crypto.randomUUID()}`))(),
    });
  }

  createShortcut(
    actor: AutomationActor,
    draft: Omit<ShortcutDefinitionInput, keyof TenantScope | 'createdBy' | 'enabled' | 'id' | 'createdAt'>,
  ): ShortcutDefinition {
    requirePermission(actor, 'automation.create');
    const shortcut = createShortcutDefinition(
      {
        ...draft,
        tenantId: actor.tenantId,
        organizationId: actor.organizationId,
        createdBy: actor.userId,
        enabled: false,
      },
      { now: () => this.now(), id: this.options.shortcutId },
    );
    const saved = this.store.createShortcut(actor, shortcut);
    this.appendAudit(actor, 'automation.shortcut.create', saved.id, null, saved);
    return saved;
  }

  getShortcut(actor: AutomationActor, shortcutId: string): ShortcutDefinition {
    requirePermission(actor, 'automation.read');
    const shortcut = this.store.getShortcut(actor, requireText(shortcutId, 'Shortcut ID'));
    if (!shortcut) throw new AutomationError('SHORTCUT_NOT_FOUND', `Shortcut not found: ${shortcutId}`);
    return shortcut;
  }

  listShortcuts(actor: AutomationActor): ShortcutDefinition[] {
    requirePermission(actor, 'automation.read');
    return this.store.listShortcuts(actor);
  }

  setEnabled(actor: AutomationActor, shortcutId: string, enabled: boolean): ShortcutDefinition {
    requirePermission(actor, 'automation.manage');
    const current = this.getShortcut({ ...actor, permissions: [...actor.permissions, 'automation.read'] }, shortcutId);
    const next: ShortcutDefinition = { ...current, enabled, updatedAt: this.now() };
    const saved = this.store.updateShortcut(actor, current.id, next);
    if (!saved) throw new AutomationError('SHORTCUT_NOT_FOUND', `Shortcut not found: ${shortcutId}`);
    this.appendAudit(actor, enabled ? 'automation.shortcut.enable' : 'automation.shortcut.disable', saved.id, current, saved);
    return saved;
  }

  async executeShortcut(
    actor: AutomationActor,
    shortcutId: string,
    event: AutomationEvent,
    services: Readonly<Record<string, unknown>> = {},
  ): Promise<AutomationExecutionRecord> {
    const shortcut = this.store.getShortcut(actor, requireText(shortcutId, 'Shortcut ID'));
    if (!shortcut) throw new AutomationError('SHORTCUT_NOT_FOUND', `Shortcut not found: ${shortcutId}`);
    if (!hasAutomationPermission(actor, 'automation.execute')) {
      const timestamp = this.now();
      const denied: AutomationExecutionRecord = {
        executionId: `execution-${crypto.randomUUID()}`,
        shortcutId: shortcut.id,
        tenantId: actor.tenantId,
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        triggerType: event.type,
        status: 'denied',
        errorCode: 'PERMISSION_DENIED',
        startedAt: timestamp,
        finishedAt: timestamp,
        actionResults: [],
      };
      this.store.saveExecution(actor, denied);
      this.appendAudit(actor, 'automation.shortcut.execute.denied', shortcut.id, null, denied);
      return denied;
    }
    const execution = await this.engine.execute({ shortcut, event, actor, services });
    this.store.saveExecution(actor, execution);
    this.appendAudit(actor, 'automation.shortcut.execute', shortcut.id, null, execution);
    return execution;
  }

  listExecutions(actor: AutomationActor): AutomationExecutionRecord[] {
    requirePermission(actor, 'automation.audit');
    return this.store.listExecutions(actor);
  }
}

const AUTOMATION_TEMPLATES = [
  {
    id: 'morning-business',
    name: 'Morning Business',
    description: 'Prepare the approved business summary workflow.',
    trigger: { type: 'schedule' as const, config: { scheduleId: 'morning-business' } },
    conditions: [],
    actions: [{ type: 'atlas.business.summary', input: {}, required: true }],
    enabled: false,
  },
  {
    id: 'payroll-friday',
    name: 'Payroll Friday',
    description: 'Run the approved payroll preflight workflow.',
    trigger: { type: 'schedule' as const, config: { scheduleId: 'payroll-friday' } },
    conditions: [],
    actions: [{ type: 'atlas.payroll.preflight', input: {}, required: true }],
    enabled: false,
  },
  {
    id: 'atlas-security-check',
    name: 'ATLAS Security Check',
    description: 'Run registered ATLAS Security diagnostic actions.',
    trigger: { type: 'manual' as const, config: {} },
    conditions: [],
    actions: [{ type: 'atlas.security.check', input: {}, required: true }],
    enabled: false,
  },
] as const;

export function listAutomationTemplates() {
  return clone(AUTOMATION_TEMPLATES);
}
