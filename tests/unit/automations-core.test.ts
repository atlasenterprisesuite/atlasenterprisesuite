import { describe, expect, it, vi } from 'vitest';
import { InMemoryAuditSink } from '../../packages/core/src';
import {
  ActionRegistry,
  AutomationEngine,
  AutomationService,
  InMemoryAutomationStore,
  createShortcutDefinition,
  listAutomationTemplates,
  type AutomationActor,
} from '../../packages/automations/src';

const scopeA = { tenantId: 'tenant-a', organizationId: 'org-a' };
const scopeB = { tenantId: 'tenant-a', organizationId: 'org-b' };

const admin: AutomationActor = {
  ...scopeA,
  userId: 'user-admin',
  permissions: ['automation.admin'],
};

function shortcut(enabled = true) {
  return createShortcutDefinition(
    {
      ...scopeA,
      id: 'shortcut-1',
      name: 'Safe shortcut',
      trigger: { type: 'manual', config: {} },
      conditions: [],
      actions: [{ type: 'atlas.test.action', input: { value: 7 }, required: true }],
      enabled,
      createdBy: 'user-admin',
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    { now: () => '2026-09-05T00:00:00.000Z', id: () => 'shortcut-1' },
  );
}

describe('ATLAS Automations core', () => {
  it('rejects executable or unsafe payload keys', () => {
    expect(() =>
      createShortcutDefinition({
        ...scopeA,
        name: 'Unsafe shortcut',
        trigger: { type: 'manual', config: {} },
        actions: [{ type: 'atlas.test.action', input: { nested: { script: 'rm -rf /' } } }],
        createdBy: 'user-admin',
      }),
    ).toThrow(/Executable or unsafe key is not allowed: script/);
  });

  it('isolates shortcut storage by tenant and organization together', () => {
    const store = new InMemoryAutomationStore();
    store.createShortcut(scopeA, shortcut());

    expect(store.getShortcut(scopeA, 'shortcut-1')?.name).toBe('Safe shortcut');
    expect(store.getShortcut(scopeB, 'shortcut-1')).toBeNull();
  });

  it('fails closed when a required action adapter is unavailable', async () => {
    const registry = new ActionRegistry();
    const laterAdapter = vi.fn();
    registry.register('atlas.later.action', laterAdapter);
    const engine = new AutomationEngine(registry, {
      now: () => '2026-09-05T00:00:00.000Z',
      id: () => 'execution-1',
    });
    const definition = createShortcutDefinition({
      ...scopeA,
      id: 'shortcut-2',
      name: 'Fail closed',
      trigger: { type: 'manual', config: {} },
      actions: [
        { type: 'atlas.missing.action', input: {}, required: true },
        { type: 'atlas.later.action', input: {}, required: true },
      ],
      enabled: true,
      createdBy: 'user-admin',
    });

    const result = await engine.execute({
      shortcut: definition,
      event: { type: 'manual' },
      actor: admin,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('ACTION_UNAVAILABLE');
    expect(result.actionResults).toHaveLength(1);
    expect(laterAdapter).not.toHaveBeenCalled();
  });

  it('creates shortcuts disabled in the actor scope and writes canonical audit', () => {
    const store = new InMemoryAutomationStore();
    const registry = new ActionRegistry();
    const engine = new AutomationEngine(registry);
    const audit = new InMemoryAuditSink();
    const service = new AutomationService(store, engine, audit, {
      now: () => '2026-09-05T00:00:00.000Z',
      shortcutId: () => 'shortcut-service',
      auditId: () => 'audit-1',
      correlationId: () => 'corr-1',
    });

    const created = service.createShortcut(admin, {
      name: 'Payroll preflight',
      trigger: { type: 'manual', config: {} },
      actions: [{ type: 'atlas.payroll.preflight', input: {} }],
    });

    expect(created).toMatchObject({
      id: 'shortcut-service',
      tenantId: scopeA.tenantId,
      organizationId: scopeA.organizationId,
      createdBy: admin.userId,
      enabled: false,
    });
    expect(audit.list(scopeA)).toHaveLength(1);
    expect(audit.list(scopeB)).toHaveLength(0);
  });

  it('records a denied execution when the actor lacks execute permission', async () => {
    const store = new InMemoryAutomationStore();
    const registry = new ActionRegistry();
    const engine = new AutomationEngine(registry);
    const audit = new InMemoryAuditSink();
    store.createShortcut(scopeA, shortcut(true));
    const service = new AutomationService(store, engine, audit, {
      now: () => '2026-09-05T00:00:00.000Z',
      auditId: () => 'audit-denied',
      correlationId: () => 'corr-denied',
    });

    const deniedActor: AutomationActor = {
      ...scopeA,
      userId: 'user-viewer',
      permissions: ['automation.read'],
    };
    const result = await service.executeShortcut(deniedActor, 'shortcut-1', { type: 'manual' });

    expect(result.status).toBe('denied');
    expect(result.errorCode).toBe('PERMISSION_DENIED');
    expect(store.listExecutions(scopeA)).toHaveLength(1);
  });

  it('ships templates disabled and adapter-only', () => {
    const templates = listAutomationTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((template) => template.enabled === false)).toBe(true);
    expect(templates.every((template) => template.actions.every((action) => action.type.startsWith('atlas.')))).toBe(true);
  });
});
