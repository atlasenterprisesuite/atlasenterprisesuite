export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type CreateAccountCommand = {
  organizationId: string;
  accountNumber: string;
  name: string;
  accountType: AccountType;
};

export type UpdateAccountCommand = CreateAccountCommand & {
  accountId: string;
  active: boolean;
};

export interface AccountWriteGateway {
  createAccount(command: CreateAccountCommand): Promise<string>;
  updateAccount(command: UpdateAccountCommand): Promise<string>;
}

const accountTypes = new Set<AccountType>(['asset', 'liability', 'equity', 'revenue', 'expense']);

function requireText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function validateType(value: string): asserts value is AccountType {
  if (!accountTypes.has(value as AccountType)) {
    throw new Error('Unsupported account type');
  }
}

export class AccountWriteService {
  constructor(private readonly gateway: AccountWriteGateway) {}

  async createAccount(command: CreateAccountCommand): Promise<string> {
    requireText(command.organizationId, 'Organization is required');
    requireText(command.accountNumber, 'Account number is required');
    requireText(command.name, 'Account name is required');
    validateType(command.accountType);
    return this.gateway.createAccount(command);
  }

  async updateAccount(command: UpdateAccountCommand): Promise<string> {
    requireText(command.organizationId, 'Organization is required');
    requireText(command.accountId, 'Account is required');
    requireText(command.accountNumber, 'Account number is required');
    requireText(command.name, 'Account name is required');
    validateType(command.accountType);
    return this.gateway.updateAccount(command);
  }
}
