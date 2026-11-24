import { describe, expect, it } from 'vitest';
import {
  cleanupTelnyxTestNumber,
  provisionTelnyxTestNumber,
  type NumberProvisioningResource,
  type NumberProvisioningStore
} from '../../supabase/functions/_shared/telephony-number-provisioning';
import type { TelnyxVoiceConfig } from '../../supabase/functions/_shared/telephony-telnyx';

const config: TelnyxVoiceConfig = {
  apiKey: 'test-key',
  connectionId: 'connection-1',
  fromNumber: '+14075550100',
  webhookUrl: 'https://example.test/webhook',
  publicKey: btoa(String.fromCharCode(...new Uint8Array(32)))
};

class MemoryStore implements NumberProvisioningStore {
  resources: NumberProvisioningResource[] = [];
  findReusableError = false;

  async findByIdempotencyKey(organizationId: string, key: string) {
    return this.resources.find((item) => item.organizationId === organizationId && item.idempotencyKey === key) ?? null;
  }

  async findReusable(organizationId: string) {
    if (this.findReusableError) throw new Error('lookup failed');
    return this.resources.find((item) =>
      item.organizationId === organizationId &&
      item.upstreamProvider === 'telnyx' &&
      ['verified', 'assigned', 'active'].includes(item.state)
    ) ?? null;
  }

  async createOrdered(input: Omit<NumberProvisioningResource, 'id'>) {
    const resource = { id: `resource-${this.resources.length + 1}`, ...input };
    this.resources.push(resource);
    return resource;
  }

  async updateResource(id: string, patch: Partial<NumberProvisioningResource>) {
    const index = this.resources.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('resource not found');
    this.resources[index] = { ...this.resources[index], ...patch };
    return this.resources[index];
  }
}

function provisionInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    idempotencyKey: 'number-test-001',
    environment: 'test',
    testScope: true,
    countryCode: 'US',
    areaCode: '407',
    config,
    ...overrides
  } as const;
}

describe('ATLAS Telnyx number provisioning proof', () => {
  it('blocks unless the server write gate, test environment, and explicit test scope are all active', async () => {
    const store = new MemoryStore();
    const fetchImpl = async () => new Response('{}', { status: 500 });

    await expect(provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: false,
      store,
      fetchImpl
    })).resolves.toMatchObject({ status: 'blocked', blocker: 'write_gate_disabled' });

    await expect(provisionTelnyxTestNumber(provisionInput({ environment: 'production' }), {
      writeEnabled: true,
      store,
      fetchImpl
    })).resolves.toMatchObject({ status: 'blocked', blocker: 'test_environment_required' });

    await expect(provisionTelnyxTestNumber(provisionInput({ testScope: false }), {
      writeEnabled: true,
      store,
      fetchImpl
    })).resolves.toMatchObject({ status: 'blocked', blocker: 'test_scope_required' });
  });

  it('reuses a verified local Telnyx resource without any provider write', async () => {
    const store = new MemoryStore();
    store.resources.push({
      id: 'resource-existing',
      organizationId: 'org-1',
      e164: '+14075550123',
      state: 'verified',
      upstreamProvider: 'telnyx',
      externalResourceId: 'telnyx-number-1',
      providerEvidence: { evidence_digest: 'digest' },
      idempotencyKey: null,
      requestDigest: null,
      createdBy: 'user-1'
    });
    let providerCalls = 0;

    const result = await provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl: async () => {
        providerCalls += 1;
        return new Response('{}', { status: 500 });
      }
    });

    expect(result).toMatchObject({ status: 'reused', resourceId: 'resource-existing' });
    expect(providerCalls).toBe(0);
  });

  it('orders exactly once after confirmed no reusable resource and provider discovery match', async () => {
    const store = new MemoryStore();
    const calls: string[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/available_phone_numbers')) {
        return new Response(JSON.stringify({
          data: [{ phone_number: '+14075550124', reservable: true, quickship: true, best_effort: false }]
        }), { status: 200 });
      }
      if (url.endsWith('/number_orders')) {
        return new Response(JSON.stringify({ data: { id: 'order-1', status: 'pending' } }), {
          status: 201,
          headers: { 'x-request-id': 'req-order-1' }
        });
      }
      throw new Error(`unexpected:${url}`);
    };

    const first = await provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl
    });
    expect(first).toMatchObject({ status: 'ordered', e164: '+14075550124', providerOrderId: 'order-1' });
    expect(calls.filter((item) => item.startsWith('POST '))).toHaveLength(1);

    const replay = await provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl
    });
    expect(replay).toMatchObject({ status: 'reused_idempotency', e164: '+14075550124' });
    expect(calls.filter((item) => item.startsWith('POST '))).toHaveLength(1);
  });

  it('blocks changed-payload idempotency conflicts and local inventory lookup errors without provider writes', async () => {
    const store = new MemoryStore();
    const fetchImpl = async () => new Response('{}', { status: 500 });
    store.resources.push({
      id: 'resource-keyed',
      organizationId: 'org-1',
      e164: '+14075550125',
      state: 'ordered',
      upstreamProvider: 'telnyx',
      externalResourceId: null,
      providerEvidence: {},
      idempotencyKey: 'number-test-001',
      requestDigest: '0'.repeat(64),
      createdBy: 'user-1'
    });

    await expect(provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl
    })).resolves.toMatchObject({ status: 'blocked', blocker: 'idempotency_conflict' });

    store.resources = [];
    store.findReusableError = true;
    let providerCalls = 0;
    await expect(provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl: async () => {
        providerCalls += 1;
        return new Response('{}', { status: 500 });
      }
    })).resolves.toMatchObject({ status: 'blocked', blocker: 'local_inventory_lookup_failed' });
    expect(providerCalls).toBe(0);
  });

  it('treats provider lookup errors as blockers instead of permission to create', async () => {
    const store = new MemoryStore();
    let orderCalls = 0;
    const result = await provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl: async (input, init) => {
        if (String(input).includes('/available_phone_numbers')) {
          return new Response('{}', { status: 500 });
        }
        if (init?.method === 'POST') orderCalls += 1;
        return new Response('{}', { status: 500 });
      }
    });

    expect(result).toMatchObject({ status: 'blocked', blocker: 'provider_lookup_failed' });
    expect(orderCalls).toBe(0);
  });

  it('marks ambiguous order transport failures for reconciliation instead of blind retry', async () => {
    const store = new MemoryStore();
    const result = await provisionTelnyxTestNumber(provisionInput(), {
      writeEnabled: true,
      store,
      fetchImpl: async (input) => {
        if (String(input).includes('/available_phone_numbers')) {
          return new Response(JSON.stringify({
            data: [{ phone_number: '+14075550126', reservable: true, quickship: true, best_effort: false }]
          }), { status: 200 });
        }
        throw new Error('network lost after write');
      }
    });

    expect(result).toMatchObject({ status: 'reconciliation_required', e164: '+14075550126' });
    expect(store.resources[0].providerEvidence).toMatchObject({ submission_state: 'ambiguous' });
  });
});

describe('ATLAS Telnyx number cleanup proof', () => {
  function resource(): NumberProvisioningResource {
    return {
      id: 'resource-cleanup',
      organizationId: 'org-1',
      e164: '+14075550127',
      state: 'ordered',
      upstreamProvider: 'telnyx',
      externalResourceId: null,
      providerEvidence: {},
      idempotencyKey: 'number-test-cleanup',
      requestDigest: 'a'.repeat(64),
      createdBy: 'user-1'
    };
  }

  it('releases locally only after a completed job explicitly identifies the target number as successful', async () => {
    const store = new MemoryStore();
    store.resources.push(resource());

    const result = await cleanupTelnyxTestNumber({
      resource: store.resources[0],
      config,
      cleanupJobId: 'job-1'
    }, {
      writeEnabled: true,
      store,
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          id: 'job-1',
          status: 'completed',
          successful_operations: [{ phone_number: '+14075550127' }],
          failed_operations: []
        }
      }), { status: 200 })
    });

    expect(result).toMatchObject({ status: 'released', cleanupJobId: 'job-1' });
    expect(store.resources[0].state).toBe('released');
  });

  it('does not falsely release on failed, expired, incomplete, or ambiguous cleanup', async () => {
    for (const jobStatus of ['failed', 'expired', 'completed'] as const) {
      const store = new MemoryStore();
      store.resources.push(resource());
      const result = await cleanupTelnyxTestNumber({
        resource: store.resources[0],
        config,
        cleanupJobId: 'job-2'
      }, {
        writeEnabled: true,
        store,
        fetchImpl: async () => new Response(JSON.stringify({
          data: {
            id: 'job-2',
            status: jobStatus,
            successful_operations: [],
            failed_operations: jobStatus === 'failed' ? [{ phone_number: '+14075550127' }] : []
          }
        }), { status: 200 })
      });

      expect(result.status).not.toBe('released');
      expect(store.resources[0].state).not.toBe('released');
    }

    const ambiguousStore = new MemoryStore();
    ambiguousStore.resources.push(resource());
    await expect(cleanupTelnyxTestNumber({
      resource: ambiguousStore.resources[0],
      config,
      cleanupJobId: null
    }, {
      writeEnabled: true,
      store: ambiguousStore,
      fetchImpl: async () => { throw new Error('offline'); }
    })).resolves.toMatchObject({ status: 'reconciliation_required' });
    expect(ambiguousStore.resources[0].state).not.toBe('released');
  });
});
