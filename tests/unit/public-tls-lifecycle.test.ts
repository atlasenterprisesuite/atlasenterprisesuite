import { describe, expect, it } from 'vitest';
import { evaluatePublicTlsCertificate } from '../../scripts/security/public-tls.mjs';

const now = new Date('2026-10-09T12:00:00.000Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toUTCString();
const host = 'www.atlasenterprisesuite.com';
const peer = (name = host, exp = 60) => ({
  valid_from: days(-10),
  valid_to: days(exp),
  subject: { CN: name },
  subjectaltname: 'DNS:' + name,
});
const verified = (updates: Record<string, unknown> = {}) => ({
  hostname: host, authorized: true, protocol: 'TLSv1.3', peer: peer(), ...updates,
});

describe('ATLAS public HTTPS TLS lifecycle', () => {
  it('verifies a trusted certificate, correct SAN, valid time and TLS 1.3', () => {
    expect(evaluatePublicTlsCertificate(verified(), { now })).toMatchObject({ status: 'ready', code: 'tls_verified' });
  });
  it('fails closed for untrusted chains, hostname mismatches, or weak protocol', () => {
    expect(evaluatePublicTlsCertificate(verified({ authorized: false }), { now }).status).toBe('blocked');
    expect(evaluatePublicTlsCertificate(verified({ peer: peer('malicious.example') }), { now }).status).toBe('blocked');
    expect(evaluatePublicTlsCertificate(verified({ protocol: 'TLSv1.1' }), { now }).status).toBe('blocked');
    expect(evaluatePublicTlsCertificate(verified({ hostname: 'attacker.example' }), { now }).status).toBe('blocked');
  });
  it('distinguishes renewal warning and critical expiration', () => {
    expect(evaluatePublicTlsCertificate(verified({ peer: peer(host, 18) }), { now }).status).toBe('warning');
    expect(evaluatePublicTlsCertificate(verified({ peer: peer(host, 5) }), { now }).status).toBe('blocked');
    expect(evaluatePublicTlsCertificate(verified({ peer: peer(host, -1) }), { now }).code).toBe('tls_certificate_expired');
  });
});
