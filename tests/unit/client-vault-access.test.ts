import { describe, expect, it } from 'vitest';
import { authorizeVault, type VaultActor, type VaultResource } from '../../packages/client-vault/src/access';
const now = 1_800_000_000_000;
const actor: VaultActor = { userId: 'u1', tenantId: 't1', clientIds: ['c1'], role: 'owner', authenticated: true, revoked: false, mfaVerifiedAt: now - 1000 };
const file: VaultResource = { tenantId: 't1', clientId: 'c1', legalHold: false };
describe('ATLAS Client Vault deny-by-default gate', () => {
  it('rejects anonymous access', () => expect(authorizeVault(null, file, 'read', now).allowed).toBe(false));
  it('rejects cross-tenant access', () => expect(authorizeVault(actor, {...file, tenantId:'t2'}, 'read', now).allowed).toBe(false));
  it('rejects cross-client access', () => expect(authorizeVault(actor, {...file, clientId:'c2'}, 'read', now).allowed).toBe(false));
  it('rejects revoked users', () => expect(authorizeVault({...actor, revoked:true}, file, 'read', now).allowed).toBe(false));
  it('rejects stale MFA for export', () => expect(authorizeVault({...actor, mfaVerifiedAt:now-400_000}, file, 'export', now).allowed).toBe(false));
  it('rejects viewer export', () => expect(authorizeVault({...actor, role:'viewer'}, file, 'export', now).allowed).toBe(false));
  it('rejects legal-hold deletion', () => expect(authorizeVault(actor, {...file, legalHold:true}, 'delete', now, ['u2','u3']).allowed).toBe(false));
  it('rejects deletion without two independent approvals', () => expect(authorizeVault(actor, file, 'delete', now, ['u2']).allowed).toBe(false));
  it('allows scoped read', () => expect(authorizeVault(actor, file, 'read', now).allowed).toBe(true));
  it('allows unlocked deletion with fresh MFA and two independent approvals', () => expect(authorizeVault(actor, file, 'delete', now, ['u2','u3']).allowed).toBe(true));
});
