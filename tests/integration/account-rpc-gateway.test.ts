import { describe, expect, test } from 'vitest';
import {
  SupabaseAccountWriteGateway,
  type CreateAccountCommand,
  type UpdateAccountCommand,
} from '../../packages/accounting/src';

type RpcCall = { name: string; args: Record<string, unknown> };

function clientWith(result: { data: unknown; error: { message: string } | null }, calls: RpcCall[]) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
  };
}

describe('SupabaseAccountWriteGateway', () => {
  test('maps create account to the governed RPC contract', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseAccountWriteGateway(clientWith({ data: 'account-new', error: null }, calls) as never);
    const command: CreateAccountCommand = {
      organizationId: 'org-test',
      accountNumber: '1100',
      name: 'Operating Cash',
      accountType: 'asset',
    };

    await expect(gateway.createAccount(command)).resolves.toBe('account-new');
    expect(calls).toEqual([{
      name: 'create_chart_account',
      args: {
        organization_uuid: 'org-test',
        account_code: '1100',
        account_name: 'Operating Cash',
        account_kind: 'asset',
      },
    }]);
  });

  test('maps updates including active state to the governed RPC contract', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseAccountWriteGateway(clientWith({ data: 'account-1', error: null }, calls) as never);
    const command: UpdateAccountCommand = {
      organizationId: 'org-test',
      accountId: 'account-1',
      accountNumber: '1100',
      name: 'Operating Cash',
      accountType: 'asset',
      active: false,
    };

    await expect(gateway.updateAccount(command)).resolves.toBe('account-1');
    expect(calls).toEqual([{
      name: 'update_chart_account',
      args: {
        organization_uuid: 'org-test',
        account_uuid: 'account-1',
        account_code: '1100',
        account_name: 'Operating Cash',
        account_kind: 'asset',
        account_active: false,
      },
    }]);
  });

  test('surfaces database errors instead of inventing success', async () => {
    const gateway = new SupabaseAccountWriteGateway(clientWith({ data: null, error: { message: 'blocked' } }, []) as never);
    await expect(gateway.createAccount({
      organizationId: 'org-test',
      accountNumber: '1100',
      name: 'Cash',
      accountType: 'asset',
    })).rejects.toThrow('blocked');
  });
});
