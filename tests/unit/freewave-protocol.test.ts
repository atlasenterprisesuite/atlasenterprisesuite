import { describe, expect, it } from 'vitest';
import { selectFreeWaveRoute } from '../../apps/web/src/lib/freewaveProtocol';

const peer = { peerId: 'local-peer-1', consent: true, paired: true, revoked: false };
const route = (overrides: Record<string, unknown> = {}) => selectFreeWaveRoute({
  localPeer: peer, transport: 'wifi-local', destination: 'local', ...overrides
} as Parameters<typeof selectFreeWaveRoute>[0]);

describe('FreeWave fail-closed routing policy', () => {
  it('permits only opted-in paired local peers over supported transport', () => {
    expect(route()).toEqual({ allowed: true, route: { kind: 'local', peerId: peer.peerId, transport: 'wifi-local' } });
  });
  it('never promotes local peer identities into PSTN routes', () => {
    expect(route({ destination: 'pstn' })).toEqual({ allowed: false, reason: 'pstn_forbidden' });
  });
  it('rejects absent consent and pairing', () => {
    expect(route({ localPeer: { ...peer, consent: false } })).toEqual({ allowed: false, reason: 'consent_required' });
    expect(route({ localPeer: { ...peer, paired: false } })).toEqual({ allowed: false, reason: 'not_paired' });
  });
  it('rejects revoked peers and unavailable radios', () => {
    expect(route({ localPeer: { ...peer, revoked: true } })).toEqual({ allowed: false, reason: 'revoked' });
    expect(route({ transport: null })).toEqual({ allowed: false, reason: 'unsupported_transport' });
  });
});
