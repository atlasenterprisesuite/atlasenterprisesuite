function copy(value) {
  return value == null ? value : structuredClone(value);
}

function tenantMap(root, tenantId) {
  if (!root.has(tenantId)) root.set(tenantId, new Map());
  return root.get(tenantId);
}

export function createMemoryAutomationStore() {
  const shortcuts = new Map();
  const executions = new Map();

  return {
    createShortcut(tenantId, shortcut) {
      const bucket = tenantMap(shortcuts, tenantId);
      bucket.set(shortcut.id, copy(shortcut));
      return copy(shortcut);
    },

    getShortcut(tenantId, shortcutId) {
      return copy(shortcuts.get(tenantId)?.get(shortcutId) ?? null);
    },

    listShortcuts(tenantId) {
      return [...(shortcuts.get(tenantId)?.values() ?? [])].map(copy);
    },

    updateShortcut(tenantId, shortcutId, patch) {
      const bucket = shortcuts.get(tenantId);
      const current = bucket?.get(shortcutId);
      if (!current) return null;
      const updated = { ...copy(current), ...copy(patch), id: current.id, tenantId: current.tenantId };
      bucket.set(shortcutId, copy(updated));
      return copy(updated);
    },

    deleteShortcut(tenantId, shortcutId) {
      const bucket = shortcuts.get(tenantId);
      const current = bucket?.get(shortcutId);
      if (!current) return null;
      bucket.delete(shortcutId);
      return copy(current);
    },

    saveExecution(tenantId, execution) {
      const bucket = tenantMap(executions, tenantId);
      bucket.set(execution.executionId, copy(execution));
      return copy(execution);
    },

    listExecutions(tenantId) {
      return [...(executions.get(tenantId)?.values() ?? [])].map(copy);
    }
  };
}
