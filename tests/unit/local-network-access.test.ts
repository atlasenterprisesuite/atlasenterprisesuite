import { describe, expect, it, vi } from 'vitest';
import {
  classifyLocalAddressSpace,
  normalizeLocalEndpointOrigin,
  probeLocalNetworkEndpoint
} from '../../apps/web/src/modules/device-os/localNetworkAccess';

describe('ATLAS Local Network Access', () => {
  it('classifies approved non-public destinations without scanning', () => {
    expect(classifyLocalAddressSpace('127.0.0.1')).toBe('loopback');
    expect(classifyLocalAddressSpace('localhost')).toBe('loopback');
    expect(classifyLocalAddressSpace('192.168.10.15')).toBe('local');
    expect(classifyLocalAddressSpace('10.1.2.3')).toBe('local');
    expect(classifyLocalAddressSpace('printer.local')).toBe('local');
    expect(classifyLocalAddressSpace('example.com')).toBeNull();
  });

  it('rejects credentials, paths and public origins from the P0 allowlist', () => {
    expect(() => normalizeLocalEndpointOrigin('http://user:pass@192.168.1.2')).toThrow('local_endpoint_credentials_not_allowed');
    expect(() => normalizeLocalEndpointOrigin('http://192.168.1.2/admin')).toThrow('local_endpoint_origin_only');
    expect(() => normalizeLocalEndpointOrigin('https://example.com')).toThrow('local_endpoint_not_non_public');
  });

  it('fails closed outside a secure context before issuing a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(probeLocalNetworkEndpoint({
      origin: 'http://192.168.1.2',
      address_space: 'local',
      probe_path: '/health',
      enabled: true
    }, { fetchImpl, secureContext: false })).rejects.toThrow('secure_context_required');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('annotates local fetches, omits credentials and rejects redirects', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const result = await probeLocalNetworkEndpoint({
      origin: 'http://192.168.1.2',
      address_space: 'local',
      probe_path: '/health',
      enabled: true
    }, { fetchImpl, secureContext: true });

    expect(result).toEqual({ reachable: true, status: 200, ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init).toMatchObject({
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      targetAddressSpace: 'local'
    });
  });

  it('does not mislabel loopback as the local address space', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 204 }));
    await probeLocalNetworkEndpoint({
      origin: 'http://127.0.0.1:8787',
      address_space: 'loopback',
      probe_path: '/',
      enabled: true
    }, { fetchImpl, secureContext: true });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init).not.toHaveProperty('targetAddressSpace');
  });
});
