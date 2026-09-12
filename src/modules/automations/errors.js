export class AutomationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.details = details;
  }
}

export const ERROR_CODES = Object.freeze({
  INVALID_SHORTCUT: 'INVALID_SHORTCUT',
  SHORTCUT_NOT_FOUND: 'SHORTCUT_NOT_FOUND',
  SHORTCUT_DISABLED: 'SHORTCUT_DISABLED',
  TRIGGER_MISMATCH: 'TRIGGER_MISMATCH',
  CONDITIONS_UNMET: 'CONDITIONS_UNMET',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  ACTION_UNAVAILABLE: 'ACTION_UNAVAILABLE',
  ACTION_FAILED: 'ACTION_FAILED',
  DUPLICATE_ACTION_TYPE: 'DUPLICATE_ACTION_TYPE'
});
