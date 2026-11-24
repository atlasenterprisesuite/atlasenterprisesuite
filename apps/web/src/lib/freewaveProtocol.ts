/** ATLAS FreeWave local-only signaling contract. No radio transport or PSTN is activated here. */
export type FreeWaveState = 'disconnected' | 'consent_required' | 'pairing' | 'local_connected' | 'unsupported';
export type FreeWavePeer = { peerId: string; consent: boolean; paired: boolean; revoked: boolean };
export type FreeWaveRoute = { kind: 'local'; peerId: string; transport: 'wifi-local' | 'bluetooth-local' };
export type FreeWaveDecision =
  | { allowed: true; route: FreeWaveRoute }
  | { allowed: false; reason: 'consent_required' | 'not_paired' | 'revoked' | 'unsupported_transport' | 'pstn_forbidden' };

export function selectFreeWaveRoute(input: {
  localPeer: FreeWavePeer | null;
  transport: FreeWaveRoute['transport'] | null;
  destination: 'local' | 'pstn';
}): FreeWaveDecision {
  if (input.destination !== 'local') return { allowed: false, reason: 'pstn_forbidden' };
  if (!input.localPeer?.consent) return { allowed: false, reason: 'consent_required' };
  if (input.localPeer.revoked) return { allowed: false, reason: 'revoked' };
  if (!input.localPeer.paired) return { allowed: false, reason: 'not_paired' };
  if (input.transport !== 'wifi-local' && input.transport !== 'bluetooth-local') {
    return { allowed: false, reason: 'unsupported_transport' };
  }
  return { allowed: true, route: { kind: 'local', peerId: input.localPeer.peerId, transport: input.transport } };
}
