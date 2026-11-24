import { describe, expect, it } from 'vitest';
import { authorizeMigrationEvidence } from '../../apps/web/src/modules/device-os/universalSetupAuthorization';

const valid = {
  actorId: 'user-a', tenantId: 'tenant-a', deviceId: 'device-a',
  permissionGranted: true, tenantMembershipVerified: true,
  consent: { actorId: 'user-a', tenantId: 'tenant-a', deviceId: 'device-a', status: 'active' as const },
  adapter: { tenantId: 'tenant-a', deviceId: 'device-a', status: 'verified' as const },
  idempotency: { tenantId: 'tenant-a', deviceId: 'device-a', status: 'reserved' as const }
};
describe('ATLAS Universal Setup negative authorization contract', () => {
  it('denies mismatched tenant and actor even when flags are true', () => {
    expect(authorizeMigrationEvidence({ ...valid, consent: { ...valid.consent, tenantId: 'tenant-b' } }).allowed).toBe(false);
    expect(authorizeMigrationEvidence({ ...valid, consent: { ...valid.consent, actorId: 'user-b' } }).allowed).toBe(false);
    expect(authorizeMigrationEvidence({ ...valid, adapter: { ...valid.adapter, tenantId: 'tenant-b' } }).allowed).toBe(false);
  });
  it('denies revoked consent and mismatched device', () => {
    expect(authorizeMigrationEvidence({ ...valid, consent: { ...valid.consent, status: 'revoked' } }).allowed).toBe(false);
    expect(authorizeMigrationEvidence({ ...valid, consent: { ...valid.consent, deviceId: 'device-b' } }).allowed).toBe(false);
  });
  it('denies replayed or absent idempotency reservation', () => {
    expect(authorizeMigrationEvidence({ ...valid, idempotency: { ...valid.idempotency, status: 'replayed' } }).allowed).toBe(false);
    expect(authorizeMigrationEvidence({ ...valid, idempotency: null }).allowed).toBe(false);
  });
  it('requires a server trust boundary and rejects client-supplied proof', () => {
    expect(authorizeMigrationEvidence({ ...valid, source: 'client' }).allowed).toBe(false);
    expect(authorizeMigrationEvidence({ ...valid, source: 'server' }).allowed).toBe(false);
  });
});
