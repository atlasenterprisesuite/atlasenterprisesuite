import { AutomationError, ERROR_CODES } from './errors.js';

function requireType(type) {
  if (typeof type !== 'string' || type.trim() === '') {
    throw new TypeError('Action type is required');
  }
  return type.trim();
}

export function createActionRegistry() {
  const adapters = new Map();

  return {
    register(type, adapter) {
      const normalized = requireType(type);
      if (typeof adapter !== 'function') throw new TypeError('Action adapter must be a function');
      if (adapters.has(normalized)) {
        throw new AutomationError(ERROR_CODES.DUPLICATE_ACTION_TYPE, `Action type already registered: ${normalized}`);
      }
      adapters.set(normalized, adapter);
      return normalized;
    },

    has(type) {
      return adapters.has(requireType(type));
    },

    async execute(type, context) {
      const normalized = requireType(type);
      const adapter = adapters.get(normalized);
      if (!adapter) {
        return { type: normalized, status: 'unavailable', errorCode: ERROR_CODES.ACTION_UNAVAILABLE };
      }
      try {
        const output = await adapter({
          tenantId: context?.tenantId,
          actor: context?.actor,
          shortcut: context?.shortcut,
          input: structuredClone(context?.input ?? {}),
          services: context?.services ?? {}
        });
        return { type: normalized, status: 'success', output: structuredClone(output) };
      } catch {
        return { type: normalized, status: 'failed', errorCode: ERROR_CODES.ACTION_FAILED };
      }
    }
  };
}
