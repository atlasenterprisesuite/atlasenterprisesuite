import { describe, expect, it } from 'vitest';
import { prepareBrowserJob, sanitizeBrowserResult } from '../../packages/execution/src/browser-executor';

// Synthetic-only fixtures: assemble at runtime to avoid false-positive
// secret-scanner incidents from hardcoded JWT-shaped strings.
const syntheticJwt = [
  'eyJhbGciOiJIUzI1NiJ9',
  'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
  'abcdefghijklmnopqrstuvwxyz',
].join('.');

describe('ATLAS 777 browser untrusted page text secret handling', () => {
  it.each([
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'password=hunter2-example-secret',
    'api_key=private-test-value-123456',
    'sk-proj-' + 'a'.repeat(32),
    syntheticJwt,
  ])('does not return credential-looking raw text: %s', raw => {
    const output = sanitizeBrowserResult('Page content: ' + raw + ' trailing text');
    expect(output).toBe('[redacted-sensitive-content]');
    expect(JSON.stringify(output)).not.toContain(raw);
  });
  it('redacts nested sensitive values, not only sensitive object keys', () => {
    expect(sanitizeBrowserResult({ title: 'Bearer abcdefghijklmnopqrstuvwxyz', safe: 'public' }))
      .toEqual({ title: '[redacted-sensitive-content]', safe: 'public' });
  });
  it('rejects credential-looking object property names in evidence', () => {
    const result = sanitizeBrowserResult({
      [syntheticJwt]: 'public',
      ['sk-proj-' + 'b'.repeat(32)]: 'public',
      safe: 'public',
    });
    expect(result).toEqual({ safe: 'public' });
    expect(JSON.stringify(result)).not.toContain(syntheticJwt);
  });
  it('preserves ordinary non-secret text and existing output length limit', () => {
    expect(sanitizeBrowserResult('Public heading')).toBe('Public heading');
    expect((sanitizeBrowserResult('x'.repeat(5000)) as string).length).toBe(2000);
  });
});

const restrictedEnvelope = {
  workflowId: 'workflow', stepId: 'step', tenantId: 'tenant', organizationId: 'org',
  allowedDomains: ['example.com'],
  allowedActions: ['navigate', 'read_text', 'click', 'type', 'submit', 'create_dns_txt', 'click_openai_check'],
  deniedActions: [], autonomyLevel: 'autonomous' as const,
  expiresAt: '2099-01-01T00:00:00Z',
};

describe('ATLAS 777 browser queue must not persist unapproved side effects or raw form secrets', () => {
  it('rejects raw type input before constructing a persisted browser job', () => {
    expect(() => prepareBrowserJob(restrictedEnvelope,
      { type: 'type', domain: 'example.com', target: '#password', value: 'synthetic-only-test-input' },
      '2026-11-02T00:00:00Z')).toThrow('browser_sensitive_input_requires_vault');
  });
  it.each(['click', 'submit', 'create_dns_txt', 'click_openai_check'] as const)(
    'rejects %s without a persisted human approval', type => {
      expect(() => prepareBrowserJob(restrictedEnvelope, { type, domain: 'example.com' },
        '2026-11-02T00:00:00Z')).toThrow('human_approval_required');
    });
  it.each(['navigate', 'read_text'] as const)(
    'rejects unexpected payload on read-only %s before queue persistence', type => {
      const target = type === 'navigate' ? 'https://example.com/' : 'h1';
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type, domain: 'example.com', target, value: 'synthetic-form-input-only' },
        '2026-11-02T00:00:00Z')).toThrow('browser_unexpected_payload');
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type, domain: 'example.com', target, metadata: { note: 'synthetic-unclassified-private-value' } },
        '2026-11-02T00:00:00Z')).toThrow('browser_unexpected_payload');
    });
  it('rejects URL query and fragment payloads before persisting navigation', () => {
    for (const target of [
      'https://example.com/?trace=synthetic-only',
      'https://example.com/#synthetic-only',
      'https://other.example/path',
    ]) {
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type: 'navigate', domain: 'example.com', target },
        '2026-11-02T00:00:00Z')).toThrow();
    }
  });
  it('rejects credential-shaped navigation path segments before durable queue persistence', () => {
    // Paths are persisted as evidence just like queries; encoded credentials
    // must not bypass the read-only queue's confidentiality boundary.
    for (const target of [
      'https://example.com/reset/' + 'sk-proj-' + 'a'.repeat(32),
      'https://example.com/session/' + syntheticJwt,
      'https://example.com/%73%6b-proj-' + 'b'.repeat(32),
      'https://example.com/access_token/synthetic-only-value',
    ]) {
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type: 'navigate', domain: 'example.com', target },
        '2026-11-02T00:00:00Z')).toThrow('browser_navigation_sensitive_path');
    }
  });
  it('does not persist unexpected envelope properties or alias mutable scope arrays', () => {
    const input = { ...restrictedEnvelope, metadata: { raw: 'synthetic-unclassified-private-value' } };
    const prepared = prepareBrowserJob(input, { type: 'read_text', domain: 'example.com', target: 'h1' },
      '2026-11-02T00:00:00Z');
    expect(JSON.stringify(prepared)).not.toContain('synthetic-unclassified-private-value');
    expect(prepared.executionEnvelope).not.toHaveProperty('metadata');
    input.allowedDomains.push('unapproved.example');
    expect(prepared.executionEnvelope.allowedDomains).toEqual(['example.com']);
  });
  it('rejects untrusted envelope domain entries before persisting the entire allowlist', () => {
    // A valid action host does not make other envelope entries safe audit data.
    for (const untrusted of [
      'https://example.com/?note=synthetic-only-private-value',
      'example.com/path/synthetic-only-private-value',
      'service.internal',
    ]) {
      const input = { ...restrictedEnvelope, allowedDomains: ['example.com', untrusted] };
      expect(() => prepareBrowserJob(input,
        { type: 'read_text', domain: 'example.com', target: 'h1' },
        '2026-11-02T00:00:00Z')).toThrow('browser_envelope_domain_invalid');
    }
  });
  it('rejects noncanonical domain input before read-only queue persistence', () => {
    for (const domain of ['https://example.com/?note=synthetic-only', 'example.com/path', 'example.com:443']) {
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type: 'read_text', domain, target: 'h1' }, '2026-11-02T00:00:00Z'))
        .toThrow('browser_domain_invalid');
    }
  });
  it('rejects untrusted read_text selectors before they reach the persisted queue', () => {
    for (const target of [
      'input[value="synthetic-only-test-value"]',
      'h1, input',
      '#main\nbody',
      'h1'.repeat(100),
      'https://example.com/?access_token=synthetic-only',
    ]) {
      expect(() => prepareBrowserJob(restrictedEnvelope,
        { type: 'read_text', domain: 'example.com', target },
        '2026-11-02T00:00:00Z')).toThrow('browser_selector_invalid');
    }
    expect(() => prepareBrowserJob(restrictedEnvelope,
      { type: 'read_text', domain: 'example.com' },
      '2026-11-02T00:00:00Z')).toThrow('browser_selector_invalid');
  });
  it('keeps simple read-only CSS selectors usable', () => {
    for (const target of ['h1', '#main', '.headline', 'main h1', 'h1.title']) {
      expect(prepareBrowserJob(restrictedEnvelope,
        { type: 'read_text', domain: 'example.com', target },
        '2026-11-02T00:00:00Z').action.target).toBe(target);
    }
  });
  it('retains safe read-only queue preparation', () => {
    expect(prepareBrowserJob(restrictedEnvelope, { type: 'navigate', domain: 'example.com',
      target: 'https://example.com/' }, '2026-11-02T00:00:00Z').action.type).toBe('navigate');
  });
});

// A parent-domain envelope is not authorization to visit arbitrary subdomains.
// Browser egress and audit scopes must use explicit host grants only.
describe('ATLAS 777 browser explicit hostname authorization', () => {
  it('rejects an unlisted subdomain before queuing read-only work', () => {
    expect(() => prepareBrowserJob(restrictedEnvelope,
      { type: 'read_text', domain: 'unapproved.example.com', target: 'h1' },
      '2026-11-02T00:00:00Z')).toThrow('browser_domain_not_allowed');
  });
  it('accepts the explicitly listed hostname without changing its scope', () => {
    expect(prepareBrowserJob(restrictedEnvelope,
      { type: 'read_text', domain: 'example.com', target: 'h1' },
      '2026-11-02T00:00:00Z').action.domain).toBe('example.com');
  });
});


describe('ATLAS 777 browser queue rejects untrusted persisted action grants', () => {
  it('rejects unrecognized allowedActions and deniedActions entries before persistence', () => {
    for (const field of ['allowedActions', 'deniedActions'] as const) {
      const input = {
        ...restrictedEnvelope,
        [field]: [...restrictedEnvelope[field], 'https://example.com/private/synthetic-only'],
      };
      expect(() => prepareBrowserJob(input,
        { type: 'read_text', domain: 'example.com', target: 'h1' },
        '2026-11-02T00:00:00Z')).toThrow('browser_envelope_action_invalid');
    }
  });
});

// Runtime payloads can bypass TypeScript types. The queue must not persist
// credential-bearing identity fields or an unrecognized autonomy level.
describe('ATLAS 777 durable browser envelope scope validation', () => {
  it('rejects credential-shaped scope fields and unrecognized autonomy before persistence', () => {
    const untrusted = 'Authorization: Bearer ' + 'x'.repeat(24);
    for (const override of [
      { tenantId: 'tenant\\n' + untrusted },
      { organizationId: 'org\\n' + untrusted },
      { workflowId: 'workflow\\n' + untrusted },
      { stepId: 'step\\n' + untrusted },
      { autonomyLevel: untrusted },
    ]) {
      expect(() => prepareBrowserJob({ ...restrictedEnvelope, ...override } as typeof restrictedEnvelope,
        { type: 'read_text', domain: 'example.com', target: 'h1' },
        '2026-11-02T00:00:00Z')).toThrow('browser_envelope_scope_invalid');
    }
  });
});
