export type CreatePostedJournalCommand = {
  organizationId: string;
  entryNumber: string;
  entryDate: string | null;
  memo: string | null;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
};

export type ReversePostedJournalCommand = {
  organizationId: string;
  journalEntryId: string;
  reversalEntryNumber: string;
  reversalDate: string | null;
  reason: string;
};

export interface JournalWriteGateway {
  createBalancedJournalEntry(command: CreatePostedJournalCommand): Promise<string>;
  reversePostedJournalEntry(command: ReversePostedJournalCommand): Promise<string>;
}

function required(value: string, message: string): string {
  if (!value.trim()) throw new Error(message);
  return value;
}

export class JournalWriteService {
  constructor(private readonly gateway: JournalWriteGateway) {}

  async createPostedJournal(command: CreatePostedJournalCommand): Promise<string> {
    required(command.organizationId, 'Organization is required');
    required(command.entryNumber, 'Entry number is required');
    required(command.debitAccountId, 'Debit account is required');
    required(command.creditAccountId, 'Credit account is required');

    if (!Number.isFinite(command.amount) || command.amount <= 0) {
      throw new Error('Journal amount must be greater than zero');
    }

    if (command.debitAccountId === command.creditAccountId) {
      throw new Error('Debit and credit accounts must differ');
    }

    return this.gateway.createBalancedJournalEntry(command);
  }

  async reversePostedJournal(command: ReversePostedJournalCommand): Promise<string> {
    required(command.organizationId, 'Organization is required');
    required(command.journalEntryId, 'Journal entry is required');
    required(command.reversalEntryNumber, 'Reversal entry number is required');
    required(command.reason, 'Reversal reason is required');

    return this.gateway.reversePostedJournalEntry(command);
  }
}
