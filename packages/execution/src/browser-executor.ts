import { evaluateBrowserAction, type BrowserExecutionEnvelope } from './browser-envelope';

export type BrowserActionType =
  | 'navigate'
  | 'read_text'
  | 'click'
  | 'type'
  | 'submit'
  | 'create_dns_txt'
  | 'click_openai_check';

export type BrowserAction = {
  type: BrowserActionType;
  domain: string;
  target?: string;
  value?: string;
  metadata?: Record<string, unknown>;
};

export type BrowserActionResult = {
  state: 'completed' | 'waiting_human' | 'failed';
  result: unknown;
};

const SENSITIVE_KEY = /token|secret|password|cookie|authorization|recovery/i;
// Page text is untrusted. Redact the entire field when common credential
// signatures appear; never retain the surrounding snippet in evidence/logs.
// This is defense in depth, not a substitute for vault/DLP certification.
const SENSITIVE_TEXT = /\b(?:authorization\s*[:=]\s*(?:bearer\s+)?\S+|bearer\s+[a-z0-9._~+/-]{8,}|(?:api[_-]?key|client[_-]?secret|password|secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S+|(?:set-cookie|cookie)\s*:\s*\S+|sk-(?:proj-)?[a-z0-9_-]{16,}|eyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})/i;
function sanitizeBrowserText(text: string): string {
  const bounded = text.slice(0, 2000);
  return SENSITIVE_TEXT.test(bounded) ? '[redacted-sensitive-content]' : bounded;
}

export function sanitizeBrowserResult(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth-limited]';
  if (typeof value === 'string') return sanitizeBrowserText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeBrowserResult(item, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      // Object keys are untrusted too: credential-shaped property names must not enter evidence.\n      if (key.length > 200 || SENSITIVE_KEY.test(key) || SENSITIVE_TEXT.test(key)) continue;
      result[key] = sanitizeBrowserResult(nested, depth + 1);
    }
    return result;
  }
  return sanitizeBrowserText(String(value ?? ''));
}

export function prepareBrowserJob(envelope: BrowserExecutionEnvelope, action: BrowserAction, now: string | Date = new Date()) {
  const decision = evaluateBrowserAction(
    envelope,
    { domain: action.domain, action: action.type },
    now,
    { workflowId: envelope.workflowId, stepId: envelope.stepId }
  );
  if (!decision.allowed) throw new Error('browser_action_not_allowed');
  // The legacy queue persists prepared actions verbatim. Never persist raw form
  // input or queue sensitive side effects without an auditable approval/vault path.
  if (action.type === 'type') throw new Error('browser_sensitive_input_requires_vault');
  if (action.type === 'click' || action.type === 'submit' ||
      action.type === 'create_dns_txt' || action.type === 'click_openai_check') {
    throw new Error('human_approval_required');
  }

  return {
    executionEnvelope: { ...envelope },
    action: {
      type: action.type,
      domain: action.domain,
      ...(action.target ? { target: action.target.slice(0, 1000) } : {}),
      ...(action.value !== undefined ? { value: action.value.slice(0, 4000) } : {}),
      ...(action.metadata ? { metadata: sanitizeBrowserResult(action.metadata) as Record<string, unknown> } : {})
    }
  };
}

export class FakeBrowserRuntimeAdapter {
  private readonly queue = new Map<BrowserActionType, BrowserActionResult[]>();

  enqueue(actionType: BrowserActionType, result: BrowserActionResult) {
    const current = this.queue.get(actionType) || [];
    current.push({ state: result.state, result: sanitizeBrowserResult(result.result) });
    this.queue.set(actionType, current);
    return this;
  }

  async execute(input: { executionEnvelope: BrowserExecutionEnvelope; action: BrowserAction }): Promise<BrowserActionResult> {
    prepareBrowserJob(input.executionEnvelope, input.action);
    const queue = this.queue.get(input.action.type) || [];
    const next = queue.shift();
    if (!next) return { state: 'failed', result: { error: 'fake_browser_result_missing' } };
    this.queue.set(input.action.type, queue);
    return { state: next.state, result: sanitizeBrowserResult(next.result) };
  }
}
