import { evaluateBrowserAction, type BrowserExecutionEnvelope } from './browser-envelope';
import { approvedUrl } from './network-policy';

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
// Queue evidence is durable: CSS attribute selectors can embed raw form values,
// access tokens, or other secrets. Only a deliberately small read-only selector
// subset is permitted until a typed selector builder and vault are certified.
const SAFE_READ_SELECTOR = /^(?:[a-z][a-z0-9_-]*|[.#][a-z_][a-z0-9_-]*)(?:[.#][a-z_][a-z0-9_-]*)*(?: +(?:[a-z][a-z0-9_-]*|[.#][a-z_][a-z0-9_-]*)(?:[.#][a-z_][a-z0-9_-]*)*)*$/i;

// Page text is untrusted. Redact the entire field when common credential
// signatures appear; never retain the surrounding snippet in evidence/logs.
// This is defense in depth, not a substitute for vault/DLP certification.
const SENSITIVE_TEXT = /\b(?:authorization\s*[:=]\s*(?:bearer\s+)?\S+|bearer\s+[a-z0-9._~+/-]{8,}|(?:api[_-]?key|client[_-]?secret|password|secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S+|(?:set-cookie|cookie)\s*:\s*\S+|sk-(?:proj-)?[a-z0-9_-]{16,}|eyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})/i;
// Navigation paths are persisted in the durable queue. Credential-shaped
// segments (including percent-encoded forms) are not safe audit metadata.
const SENSITIVE_PATH_SEGMENT = /(?:^|\/)(?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization|bearer)(?:\/|$|[=:])/i;
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
      // Object keys are untrusted too: credential-shaped property names must not enter evidence.
      if (key.length > 200 || SENSITIVE_KEY.test(key) || SENSITIVE_TEXT.test(key)) continue;
      result[key] = sanitizeBrowserResult(nested, depth + 1);
    }
    return result;
  }
  return sanitizeBrowserText(String(value ?? ''));
}

export function prepareBrowserJob(envelope: BrowserExecutionEnvelope, action: BrowserAction, now: string | Date = new Date()) {
  // Only a canonical hostname may be used as a queue domain. Envelope matching
  // normalizes URL-like strings, which must never be persisted as raw domains.
  if (typeof action.domain !== 'string' ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i.test(action.domain)) {
    throw new Error('browser_domain_invalid');
  }
  try { approvedUrl('https://' + action.domain + '/', [action.domain]); }
  catch { throw new Error('browser_domain_invalid'); }
  // The complete allowlist is stored durably, not just the selected host.
  // Reject URL-like, internal or malformed extra entries before persistence.
  // Legacy envelope matching is deliberately permissive; browser queues are not.
  if (!Array.isArray(envelope.allowedDomains) || envelope.allowedDomains.length > 64 ||
      !envelope.allowedDomains.every((domain) => {
        if (typeof domain !== 'string' ||
            !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i.test(domain)) return false;
        try { approvedUrl('https://' + domain + '/', [domain]); return true; }
        catch { return false; }
      })) throw new Error('browser_envelope_domain_invalid');
  const decision = evaluateBrowserAction(
    envelope,
    { domain: action.domain, action: action.type },
    now,
    { workflowId: envelope.workflowId, stepId: envelope.stepId }
  );
  if (!decision.allowed) throw new Error('browser_action_not_allowed');
  // Envelope evaluation also permits subdomains for legacy workflows. A browser
  // queue grant must name the exact host: an implicit subdomain can be controlled
  // by a different principal and must never inherit network authorization.
  if (!envelope.allowedDomains.some(allowed =>
    typeof allowed === 'string' && allowed.toLowerCase() === action.domain.toLowerCase())) {
    throw new Error('browser_domain_not_allowed');
  }
  // The legacy queue persists prepared actions verbatim. Never persist raw form
  // input or queue sensitive side effects without an auditable approval/vault path.
  if (action.type === 'type') throw new Error('browser_sensitive_input_requires_vault');
  if (action.type === 'click' || action.type === 'submit' ||
      action.type === 'create_dns_txt' || action.type === 'click_openai_check') {
    throw new Error('human_approval_required');
  }

  // A read-only job must have a closed payload schema. Unknown metadata and
  // values may contain secrets that redaction heuristics cannot recognize.
  if (action.type !== 'navigate' && action.type !== 'read_text') throw new Error('unsupported_action');
  if (action.value !== undefined || action.metadata !== undefined) {
    throw new Error('browser_unexpected_payload');
  }
  if (action.type === 'read_text' &&
      (typeof action.target !== 'string' || action.target.length === 0 ||
       action.target.length > 160 || !SAFE_READ_SELECTOR.test(action.target) ||
       SENSITIVE_TEXT.test(action.target))) {
    throw new Error('browser_selector_invalid');
  }
  let safeTarget = action.target;
  if (action.type === 'navigate' && action.target !== undefined) {
    // Existing queue clients may supply relative paths. Resolve them against
    // the approved host before persistence; deny queries and fragments.
    try {
      const destination = approvedUrl(new URL(action.target, 'https://' + action.domain + '/').href, [action.domain]);
      if (destination.search || destination.hash) throw new Error('browser_navigation_query_not_allowed');
      // Reject path-borne secrets before they become durable queue evidence.
      // Repeated decoding also catches double-encoded credential signatures.
      let decodedPath = destination.pathname;
      for (let i = 0; i < 3; i++) {
        const next = decodeURIComponent(decodedPath);
        if (next === decodedPath) break;
        decodedPath = next;
      }
      if (destination.href.length > 1000 || /%[0-9a-f]{2}/i.test(decodedPath) ||
          SENSITIVE_TEXT.test(decodedPath) || SENSITIVE_PATH_SEGMENT.test(decodedPath)) {
        throw new Error('browser_navigation_sensitive_path');
      }
      safeTarget = destination.href;
    } catch (error) {
      if (error instanceof Error && (error.message === 'browser_navigation_query_not_allowed' ||
          error.message === 'browser_navigation_sensitive_path')) throw error;
      throw new Error('unsafe_navigation');
    }
  }

  return {
    // Closed persisted schema: runtime callers can attach extra keys even if
    // TypeScript's declared envelope type does not include them.
    executionEnvelope: {
      workflowId: envelope.workflowId,
      stepId: envelope.stepId,
      tenantId: envelope.tenantId,
      organizationId: envelope.organizationId,
      allowedDomains: [...envelope.allowedDomains],
      allowedActions: [...envelope.allowedActions],
      deniedActions: [...envelope.deniedActions],
      autonomyLevel: envelope.autonomyLevel,
      expiresAt: envelope.expiresAt,
    },
    action: {
      type: action.type,
      domain: action.domain,
      ...(safeTarget ? { target: safeTarget.slice(0, 1000) } : {})
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
