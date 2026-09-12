import { describe, expect, it } from 'vitest';
import { createAtlasIdentitySource } from '../../apps/web/src/lib/supabase/atlasIdentitySource';

describe('ATLAS identity session actions', () => {
  it('delegates credentials to Supabase without echoing the password into application state', async () => {
    const calls: unknown[] = [];
    const client = {
      auth: {
        signInWithPassword: async (payload: unknown) => {
          calls.push(['signIn', payload]);
          return { data: { session: { access_token: 'token' } }, error: null };
        },
        signOut: async () => {
          calls.push(['signOut']);
          return { error: null };
        },
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      rpc: async () => ({ data: [], error: null }),
    };

    const source = createAtlasIdentitySource(client as never);
    const result = await source.signIn('owner@example.com', 'super-secret');

    expect(calls[0]).toEqual(['signIn', { email: 'owner@example.com', password: 'super-secret' }]);
    expect(result).toBeUndefined();

    await source.signOut();
    expect(calls[1]).toEqual(['signOut']);
  });

  it('fails closed when auth actions are used without runtime configuration', async () => {
    const source = createAtlasIdentitySource(null);

    await expect(source.signIn('owner@example.com', 'secret')).rejects.toThrow('configuration_required');
    await expect(source.signOut()).resolves.toBeUndefined();
  });
});
