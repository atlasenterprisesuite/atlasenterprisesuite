import { GigsGatedAdapter, GigsProviderNotAuthorizedError } from './gigs-gated-adapter.ts';
import type { MvnoProviderContext } from './mvno.ts';

const context: MvnoProviderContext = {
  organizationId: 'org-a', tenantId: 'tenant-a', userId: 'user-a',
  providerInstanceId: 'gigs-a', correlationId: 'correlation-a',
  idempotencyKey: 'operation-a',
  permissions: [
    'wireless.mvno.read', 'wireless.mvno.provision',
    'wireless.mvno.activate', 'wireless.mvno.suspend',
    'wireless.mvno.reconnect', 'wireless.mvno.revoke'
  ]
};

Deno.test('Gigs remains pending without wholesale authorization', async () => {
  const adapter = new GigsGatedAdapter();
  const result = await adapter.readiness(context);
  if (result.state !== 'pending_provider' || result.capabilities.length !== 0) {
    throw new Error('Unverified Gigs provider must never advertise readiness or capabilities');
  }
});

Deno.test('Gigs rejects missing tenant before any carrier operation', async () => {
  const adapter = new GigsGatedAdapter();
  try {
    await adapter.provision({ ...context, tenantId: '' }, {
      subscriberId: 'subscriber-a', requestedCapabilities: ['esim']
    });
    throw new Error('Expected tenant rejection');
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'mvno_context_required:tenantId') throw error;
  }
});

Deno.test('Gigs rejects unauthorized actor before carrier operation', async () => {
  const adapter = new GigsGatedAdapter();
  try {
    await adapter.activate({ ...context, permissions: ['wireless.mvno.read'] }, 'subscriber-a');
    throw new Error('Expected permission rejection');
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'mvno_permission_denied:wireless.mvno.activate') throw error;
  }
});

Deno.test('Gigs blocks all carrier mutations without authenticated provider evidence', async () => {
  const adapter = new GigsGatedAdapter();
  const operations = [
    () => adapter.provision(context, { subscriberId: 'subscriber-a', requestedCapabilities: ['esim'] }),
    () => adapter.activate(context, 'subscriber-a'),
    () => adapter.suspend(context, 'subscriber-a'),
    () => adapter.reconnect(context, 'subscriber-a'),
    () => adapter.revoke(context, 'subscriber-a'),
    () => adapter.getSubscriber(context, 'subscriber-a')
  ];
  for (const operation of operations) {
    try {
      await operation();
      throw new Error('Carrier operation unexpectedly succeeded');
    } catch (error) {
      if (!(error instanceof GigsProviderNotAuthorizedError)) throw error;
    }
  }
});
