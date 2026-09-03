import { hasCapability } from '../../core/permissions.js';
import { AutomationError, ERROR_CODES } from './errors.js';
import { createShortcutDefinition } from './shortcut-definition.js';
import { listAutomationTemplates } from './templates.js';

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} is required`);
  return value.trim();
}

function requireActor(actor) {
  if (!actor || typeof actor !== 'object') throw new TypeError('actor is required');
  return {
    tenantId: requireText(actor.tenantId, 'tenantId'),
    userId: requireText(actor.userId, 'userId'),
    role: requireText(actor.role, 'role')
  };
}

function denied(capability) {
  throw new AutomationError(ERROR_CODES.PERMISSION_DENIED, `Missing capability: ${capability}`);
}

function assertCapability(actor, capability) {
  if (!hasCapability(actor.role, capability)) denied(capability);
}

export function createAutomationService({
  store,
  engine,
  now = () => new Date().toISOString(),
  id = () => `shortcut-${crypto.randomUUID()}`,
  auditId = () => `execution-${crypto.randomUUID()}`
}) {
  if (!store) throw new TypeError('store is required');
  if (!engine) throw new TypeError('engine is required');

  function requireShortcut(actor, shortcutId) {
    const shortcut = store.getShortcut(actor.tenantId, requireText(shortcutId, 'shortcutId'));
    if (!shortcut) {
      throw new AutomationError(ERROR_CODES.SHORTCUT_NOT_FOUND, `Shortcut not found: ${shortcutId}`);
    }
    return shortcut;
  }

  function setEnabled(actorInput, shortcutId, enabled) {
    const actor = requireActor(actorInput);
    assertCapability(actor, 'automation.manage');
    const shortcut = requireShortcut(actor, shortcutId);
    return store.updateShortcut(actor.tenantId, shortcut.id, { enabled, updatedAt: now() });
  }

  return {
    createShortcut(actorInput, input) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.create');
      const shortcut = createShortcutDefinition({
        ...(input ?? {}),
        tenantId: actor.tenantId,
        createdBy: actor.userId,
        enabled: false
      }, { now, id });
      return store.createShortcut(actor.tenantId, shortcut);
    },

    getShortcut(actorInput, shortcutId) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.read');
      return requireShortcut(actor, shortcutId);
    },

    listShortcuts(actorInput) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.read');
      return store.listShortcuts(actor.tenantId);
    },

    updateShortcut(actorInput, shortcutId, patch = {}) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.update');
      const existing = requireShortcut(actor, shortcutId);
      const safePatch = { ...patch };
      for (const key of ['id', 'tenantId', 'createdBy', 'createdAt', 'enabled', 'updatedAt']) delete safePatch[key];
      const updated = createShortcutDefinition({
        ...existing,
        ...safePatch,
        id: existing.id,
        tenantId: existing.tenantId,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        enabled: existing.enabled
      }, { now, id: () => existing.id });
      return store.updateShortcut(actor.tenantId, existing.id, updated);
    },

    deleteShortcut(actorInput, shortcutId) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.delete');
      const shortcut = requireShortcut(actor, shortcutId);
      return store.deleteShortcut(actor.tenantId, shortcut.id);
    },

    enableShortcut(actorInput, shortcutId) {
      return setEnabled(actorInput, shortcutId, true);
    },

    disableShortcut(actorInput, shortcutId) {
      return setEnabled(actorInput, shortcutId, false);
    },

    async executeShortcut(actorInput, shortcutId, event, services = {}) {
      const actor = requireActor(actorInput);
      if (!hasCapability(actor.role, 'automation.execute')) {
        const timestamp = now();
        const record = {
          executionId: auditId(),
          shortcutId: requireText(shortcutId, 'shortcutId'),
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          triggerType: event?.type ?? null,
          status: 'denied',
          errorCode: ERROR_CODES.PERMISSION_DENIED,
          startedAt: timestamp,
          finishedAt: timestamp,
          actionResults: []
        };
        return store.saveExecution(actor.tenantId, record);
      }
      const shortcut = requireShortcut(actor, shortcutId);
      const record = await engine.execute({ shortcut, event, actor, services });
      return store.saveExecution(actor.tenantId, record);
    },

    listExecutions(actorInput) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.audit');
      return store.listExecutions(actor.tenantId);
    },

    listTemplates(actorInput) {
      const actor = requireActor(actorInput);
      assertCapability(actor, 'automation.read');
      return listAutomationTemplates();
    }
  };
}
