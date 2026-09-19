import { evaluateBrowserAction, type BrowserExecutionEnvelope } from './browser-envelope';

export type BrowserActionType =
  | 'navigate'
  | 'read_text'
  | 'click'
  | 'type'
  | 'submit'
  | 'oauth_consent'
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

export function sanitizeBrowserResult(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth-limited]';
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeBrowserResult(item, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      if (SENSITIVE_KEY.test(key)) continue;
      result[key] = sanitizeBrowserResult(nested, depth + 1);
    }
    return result;
  }
  return String(value ?? '').slice(0, 2000);
}

export function prepareBrowserJob(envelope: BrowserExecutionEnvelope, action: BrowserAction, now: string | Date = new Date()) {
  const decision = evaluateBrowserAction(
    envelope,
    { domain: action.domain, action: action.type },
    now,
    { workflowId: envelope.workflowId, stepId: envelope.stepId }
  );
  if (!decision.allowed) throw new Error('browser_action_not_allowed');

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
