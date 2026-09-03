import { ERROR_CODES } from './errors.js';

function getPath(root, path) {
  const parts = String(path ?? '').split('.').filter(Boolean);
  let value = root;
  for (const part of parts) {
    if (value == null || typeof value !== 'object' || !(part in value)) return { exists: false, value: undefined };
    value = value[part];
  }
  return { exists: true, value };
}

function conditionPasses(condition, context) {
  const resolved = getPath(context, condition.path);
  if (condition.type === 'exists') return resolved.exists;
  if (!resolved.exists) return false;
  if (condition.type === 'equals') return Object.is(resolved.value, condition.value);
  if (condition.type === 'notEquals') return !Object.is(resolved.value, condition.value);
  if (condition.type === 'in') return Array.isArray(condition.value) && condition.value.some((entry) => Object.is(entry, resolved.value));
  return false;
}

function triggerMatches(trigger, event) {
  if (!event || event.type !== trigger.type) return false;
  if (trigger.type === 'module.event' || trigger.type === 'network.event') {
    return trigger.config?.event ? event.name === trigger.config.event : true;
  }
  if (trigger.type === 'schedule') {
    return trigger.config?.scheduleId ? event.scheduleId === trigger.config.scheduleId : true;
  }
  return trigger.type === 'manual';
}

export function createAutomationEngine({ registry, now = () => new Date().toISOString(), id = () => `execution-${crypto.randomUUID()}` }) {
  if (!registry) throw new TypeError('registry is required');

  async function execute({ shortcut, event, actor, services = {} }) {
    if (!shortcut) throw new TypeError('shortcut is required');
    if (!actor) throw new TypeError('actor is required');
    const startedAt = now();
    const base = {
      executionId: id(),
      shortcutId: shortcut.id,
      tenantId: shortcut.tenantId,
      actorUserId: actor.userId,
      triggerType: event?.type ?? shortcut.trigger?.type ?? null,
      startedAt,
      finishedAt: startedAt,
      actionResults: []
    };

    const skipped = (errorCode) => ({ ...base, status: 'skipped', errorCode, finishedAt: now() });

    if (!shortcut.enabled) return skipped(ERROR_CODES.SHORTCUT_DISABLED);
    if (!triggerMatches(shortcut.trigger, event)) return skipped(ERROR_CODES.TRIGGER_MISMATCH);

    const conditionContext = { event, actor, shortcut };
    if (!(shortcut.conditions ?? []).every((condition) => conditionPasses(condition, conditionContext))) {
      return skipped(ERROR_CODES.CONDITIONS_UNMET);
    }

    const actionResults = [];
    let requiredFailure = false;
    for (const action of shortcut.actions ?? []) {
      const result = await registry.execute(action.type, {
        tenantId: shortcut.tenantId,
        actor,
        shortcut,
        input: action.input ?? {},
        services
      });
      actionResults.push(result);
      if ((result.status === 'failed' || result.status === 'unavailable') && action.required !== false) {
        requiredFailure = true;
        break;
      }
    }

    return {
      ...base,
      status: requiredFailure ? 'failed' : 'success',
      finishedAt: now(),
      actionResults
    };
  }

  return { execute };
}
