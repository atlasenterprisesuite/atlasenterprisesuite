import { describe, expect, test } from 'vitest';
import {
  AccountWriteService,
  type AccountWriteGateway,
  type CreateAccountCommand,
  type UpdateAccountCommand,
} from '../../packages/accounting/src';

class RecordingGateway implements AccountWriteGateway {
  created: CreateAccountCommand[] = [];
  updated: UpdateAccountCommand[] = [];

  async createAccount(command: CreateAccountCommand): Promise<string> {
    this.created.push(command);
    return 'account-created';
  }

  async updateAccount(command: UpdateAccountCommand): Promise<string> {
    this.updated.push(command);
    return command.accountId;
  }
}

describe('AccountWriteService', () => {
  test('creates an account only after validating canonical fields', async () => {
    const gateway = new RecordingGateway();
    const service = new AccountWriteService(gateway);
    const command: CreateAccountCommand = {
      organizationId: 'org-test',
      accountNumber: '1100',
      name: 'Operating Cash',
      accountType: 'asset',
    };

    await expect(service.createAccount(command)).resolves.toBe('account-created');
    expect(gateway.created).toEqual([command]);
  });

  test.each([
    ['organizationId', { organizationId: '', accountNumber: '1100', name: 'Cash', accountType: 'asset' }],
    ['accountNumber', { organizationId: 'org-test', accountNumber: '', name: 'Cash', accountType: 'asset' }],
    ['name', { organizationId: 'org-test', accountNumber: '1100', name: '', accountType: 'asset' }],
  ])('rejects create when %s is empty', async (_field, command) => {
    const service = new AccountWriteService(new RecordingGateway());
    await expect(service.createAccount(command as CreateAccountCommand)).rejects.toThrow();
  });

  test('rejects unsupported account types', async () => {
    const service = new AccountWriteService(new RecordingGateway());
    await expect(service.createAccount({
      organizationId: 'org-test',
      accountNumber: '9999',
      name: 'Unknown',
      accountType: 'mystery',
    } as CreateAccountCommand)).rejects.toThrow('Unsupported account type');
  });

  test('updates account identity and active state without destructive deletion', async () => {
    const gateway = new RecordingGateway();
    const service = new AccountWriteService(gateway);
    const command: UpdateAccountCommand = {
      organizationId: 'org-test',
      accountId: 'account-1',
      accountNumber: '1100',
      name: 'Operating Cash',
      accountType: 'asset',
      active: false,
    };

    await expect(service.updateAccount(command)).resolves.toBe('account-1');
    expect(gateway.updated).toEqual([command]);
  });
});
