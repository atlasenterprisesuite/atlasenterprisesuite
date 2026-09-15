import { expect, it } from 'vitest';
import { connectionCanSatisfy } from '../../packages/execution/src/work-connections';

it('requires active provider and capability match', () => {
  expect(connectionCanSatisfy(
    { id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read','dns.write.txt'] },
    { provider: 'Cloudflare', capability: 'dns.write.txt' }
  )).toBe(true);
});

it('rejects revoked references', () => {
  expect(connectionCanSatisfy(
    { id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'revoked', capabilities: ['dns.write.txt'] },
    { provider: 'cloudflare', capability: 'dns.write.txt' }
  )).toBe(false);
});

it('requires an exact capability rather than prefix matching', () => {
  expect(connectionCanSatisfy(
    { id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.write'] },
    { provider: 'cloudflare', capability: 'dns.write.txt' }
  )).toBe(false);
});
