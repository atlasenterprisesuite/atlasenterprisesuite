import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  resolve4: vi.fn().mockResolvedValue(['8.8.8.8']),
  resolve6: vi.fn().mockResolvedValue(['2606:4700:4700::1111']),
}));

import { resolve4, resolve6 } from 'node:dns/promises';
import { resolvePublicDnsNode } from '../../packages/execution/src/dns-egress-node.mjs';

describe('Node-only DNS preflight adapter (network-free fixture)', () => {
  it('uses both real resolver interfaces and checks all answers before returning preflight evidence', async () => {
    const result = await resolvePublicDnsNode('https://example.com/', ['example.com']);
    expect(resolve4).toHaveBeenCalledWith('example.com');
    expect(resolve6).toHaveBeenCalledWith('example.com');
    expect(result).toEqual({
      hostname: 'example.com',
      addresses: ['8.8.8.8', '2606:4700:4700::1111'],
    });
  });
});
