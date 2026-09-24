import { expect, it } from 'vitest';
import { evaluateBrowserAction } from '../../packages/execution/src/browser-envelope';

const envelope = {
  workflowId: 'wf-1', stepId: 'step-1', tenantId: 'tenant-1', organizationId: 'org-1',
  allowedDomains: ['openai.com', 'dash.cloudflare.com'],
  allowedActions: ['navigate', 'read', 'create_dns_txt', 'click_openai_check'],
  deniedActions: ['delete_dns_record', 'change_nameservers', 'purchase'],
  autonomyLevel: 'guided' as const,
  expiresAt: '2026-09-12T22:00:00Z'
};

it('allows an explicitly-scoped action', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'openai.com', action: 'navigate' }, '2026-09-12T21:00:00Z').allowed).toBe(true);
});

it('allows dot-delimited subdomains of an allowed domain', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'auth.openai.com', action: 'navigate' }, '2026-09-12T21:00:00Z').allowed).toBe(true);
});

it('denies a nameserver change even on an allowed domain', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'dash.cloudflare.com', action: 'change_nameservers' }, '2026-09-12T21:00:00Z').allowed).toBe(false);
});

it('denies expired envelopes and scope drift', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'openai.com', action: 'navigate' }, '2026-09-12T23:00:00Z').allowed).toBe(false);
  expect(evaluateBrowserAction(envelope, { domain: 'openai.com', action: 'navigate' }, '2026-09-12T21:00:00Z', { workflowId: 'wf-x', stepId: 'step-1' }).allowed).toBe(false);
});
