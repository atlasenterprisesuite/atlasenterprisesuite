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
  it('retains safe read-only queue preparation', () => {
    expect(prepareBrowserJob(restrictedEnvelope, { type: 'navigate', domain: 'example.com',
      target: 'https://example.com/' }, '2026-11-02T00:00:00Z').action.type).toBe('navigate');
  });
});
