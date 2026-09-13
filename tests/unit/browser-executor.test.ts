import { expect, it } from 'vitest';
import { prepareBrowserJob, sanitizeBrowserResult } from '../../packages/execution/src/browser-executor';

const envelope = {
  workflowId: 'wf-1', stepId: 'step-1', tenantId: 'tenant-1', organizationId: 'org-1',
  allowedDomains: ['openai.com'], allowedActions: ['navigate'], deniedActions: ['purchase'],
  autonomyLevel: 'guided' as const, expiresAt: '2026-09-12T22:00:00Z'
};

it('rejects an action outside the execution envelope', () => {
  expect(() => prepareBrowserJob(envelope, { type: 'purchase' as any, domain: 'openai.com' }, '2026-09-12T21:00:00Z'))
    .toThrow('browser_action_not_allowed');
});

it('sanitizes nested result keys and caps strings and arrays', () => {
  const result = sanitizeBrowserResult({
    token: 'drop-me',
    nested: { authorization: 'drop-me-too', text: 'x'.repeat(2500) },
    items: Array.from({ length: 60 }, (_, index) => ({ index, cookie: 'drop' }))
  }) as any;
  expect(result).not.toHaveProperty('token');
  expect(result.nested).not.toHaveProperty('authorization');
  expect(result.nested.text).toHaveLength(2000);
  expect(result.items).toHaveLength(50);
  expect(result.items[0]).not.toHaveProperty('cookie');
});

it('prepares a credential-free allowed job', () => {
  const job = prepareBrowserJob(envelope, { type: 'navigate', domain: 'openai.com', target: '/gpts/editor' }, '2026-09-12T21:00:00Z');
  expect(job.action.type).toBe('navigate');
  expect(JSON.stringify(job)).not.toMatch(/authorization|cookie/i);
});
