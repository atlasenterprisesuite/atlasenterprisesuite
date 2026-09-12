import { AutomationError, ERROR_CODES } from './errors.js';

const TRIGGER_TYPES = new Set(['manual', 'schedule', 'module.event', 'network.event']);
const CONDITION_TYPES = new Set(['equals', 'notEquals', 'in', 'exists']);
const FORBIDDEN_KEYS = new Set(['command', 'shell', 'script', 'eval', 'function', 'dynamicImport']);

function invalid(message, details) {
  throw new AutomationError(ERROR_CODES.INVALID_SHORTCUT, message, details);
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') invalid(`${label} is required`);
  return value.trim();
}

function requireObject(value, label) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object`);
  return value;
}

function assertDeclarative(value, path = 'payload') {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDeclarative(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) invalid(`Executable key is not allowed: ${key}`, { path: `${path}.${key}` });
    if (typeof child === 'function') invalid('Executable values are not allowed', { path: `${path}.${key}` });
    assertDeclarative(child, `${path}.${key}`);
  }
}

function normalizeTrigger(trigger) {
  requireObject(trigger, 'Trigger');
  const type = requireText(trigger.type, 'Trigger type');
  if (!TRIGGER_TYPES.has(type)) invalid(`Unsupported trigger type: ${type}`);
  const config = trigger.config == null ? {} : requireObject(trigger.config, 'Trigger config');
  assertDeclarative(config, 'trigger.config');
  if (type === 'module.event') {
    const event = requireText(config.event, 'Module event');
    if (!event.includes('.')) invalid('Module event must be namespaced');
  }
  return { type, config: structuredClone(config) };
}

function normalizeConditions(conditions = []) {
  if (!Array.isArray(conditions)) invalid('Conditions must be an array');
  return conditions.map((condition, index) => {
    requireObject(condition, `Condition ${index}`);
    const type = requireText(condition.type, `Condition ${index} type`);
    if (!CONDITION_TYPES.has(type)) invalid(`Unsupported condition type: ${type}`);
    const path = requireText(condition.path, `Condition ${index} path`);
    if (type === 'in' && !Array.isArray(condition.value)) invalid('Condition value for in must be an array');
    assertDeclarative(condition.value, `conditions[${index}].value`);
    return type === 'exists' ? { type, path } : { type, path, value: structuredClone(condition.value) };
  });
}

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) invalid('At least one action is required');
  return actions.map((action, index) => {
    requireObject(action, `Action ${index}`);
    const type = requireText(action.type, `Action ${index} type`);
    const input = action.input == null ? {} : requireObject(action.input, `Action ${index} input`);
    assertDeclarative(input, `actions[${index}].input`);
    if (action.required != null && typeof action.required !== 'boolean') invalid(`Action ${index} required must be boolean`);
    return { type, input: structuredClone(input), required: action.required ?? true };
  });
}

export function validateShortcutDefinition(input) {
  requireObject(input, 'Shortcut');
  requireText(input.tenantId, 'Tenant ID');
  requireText(input.name, 'Name');
  requireText(input.createdBy, 'Created by');
  if (input.description != null && typeof input.description !== 'string') invalid('Description must be a string');
  normalizeTrigger(input.trigger);
  normalizeConditions(input.conditions ?? []);
  normalizeActions(input.actions);
  if (input.enabled != null && typeof input.enabled !== 'boolean') invalid('Enabled must be boolean');
  return true;
}

export function createShortcutDefinition(input, { now = () => new Date().toISOString(), id = () => `shortcut-${crypto.randomUUID()}` } = {}) {
  validateShortcutDefinition(input);
  const timestamp = now();
  return {
    id: input.id ? requireText(input.id, 'Shortcut ID') : id(),
    tenantId: requireText(input.tenantId, 'Tenant ID'),
    name: requireText(input.name, 'Name'),
    description: typeof input.description === 'string' ? input.description.trim() : '',
    trigger: normalizeTrigger(input.trigger),
    conditions: normalizeConditions(input.conditions ?? []),
    actions: normalizeActions(input.actions),
    enabled: input.enabled ?? false,
    createdBy: requireText(input.createdBy, 'Created by'),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp
  };
}
