import {describe, expect, it, vi} from 'vitest';
import {requireIdentityShieldAdmin} from '../../supabase/functions/_shared/identity-shield-guard';
const org = '11111111-1111-4111-8111-111111111111';
function client(opts: {user?: boolean; permission?: boolean; error?: boolean; aal?: string; sub?: string} = {}) {
  return {
    auth: {getUser: vi.fn(async () => ({data: {user: opts.user === false ? null : {id: 'user-a'}}, error: opts.error ? new Error('offline') : null})), getClaims: vi.fn(async () => ({data: {claims: {aal: opts.aal ?? 'aal2', sub: opts.sub ?? 'user-a'}}, error: opts.error ? new Error('offline') : null}))},
    rpc: vi.fn(async () => ({data: opts.permission === false ? false : true, error: opts.error ? new Error('offline') : null})),
  };
}
describe('Identity Shield server authorization fail-closed', () => {
  it('requires a verified user, AAL2 and permission', async () => {
    await expect(requireIdentityShieldAdmin(client(), org)).resolves.toEqual({userId:'user-a',organizationId:org});
  });
  it.each([{user:false},{permission:false},{error:true}])('rejects unavailable identity or permission %j', async (opts) => {
    await expect(requireIdentityShieldAdmin(client(opts), org)).rejects.toThrow('identity_shield_denied');
  });
  it('rejects AAL1 and missing claims', async () => {
    await expect(requireIdentityShieldAdmin(client({aal:'aal1'}), org)).rejects.toThrow();
    await expect(requireIdentityShieldAdmin(client({aal:'none'}), org)).rejects.toThrow();
  });
  it('rejects mismatched verified identity subject', async () => {
    await expect(requireIdentityShieldAdmin(client({sub:'different-user'}), org)).rejects.toThrow('identity_shield_denied');
  });
  it('rejects invalid organization before any privileged lookup', async () => {
    const sb=client();
    await expect(requireIdentityShieldAdmin(sb, 'not-an-org')).rejects.toThrow();
    expect(sb.auth.getUser).not.toHaveBeenCalled();
  });
  it('does not query tenant permission for an unverified or downgraded identity', async () => {
    for (const opts of [{user:false},{aal:'aal1'},{sub:'other-user'},{error:true}]) {
      const sb=client(opts);
      await expect(requireIdentityShieldAdmin(sb,org)).rejects.toThrow('identity_shield_denied');
      expect(sb.rpc).not.toHaveBeenCalled();
    }
  });
  it('scopes permission checks to the requested organization and required capability', async () => {
    const sb=client();
    await requireIdentityShieldAdmin(sb,org);
    expect(sb.rpc).toHaveBeenCalledExactlyOnceWith('has_identity_permission',{o:org,p:'identity.shield.manage'});
  });
  it('does not query identity providers for invalid organization identifiers', async () => {
    for (const invalid of ['', '11111111-1111-1111-1111-111111111111', '11111111-1111-4111-0111-111111111111', '../other-org']) {
      const sb=client();
      await expect(requireIdentityShieldAdmin(sb,invalid)).rejects.toThrow('identity_shield_denied');
      expect(sb.auth.getUser).not.toHaveBeenCalled();
      expect(sb.auth.getClaims).not.toHaveBeenCalled();
      expect(sb.rpc).not.toHaveBeenCalled();
    }
  });

});
