import { createContext, useContext, type ReactNode } from 'react';
import type { JournalWriteService } from '../../../../../packages/accounting/src';

const AccountingWriteContext = createContext<JournalWriteService | null | undefined>(undefined);

export function AccountingWriteProvider({
  service,
  children,
}: {
  service: JournalWriteService | null;
  children: ReactNode;
}) {
  return (
    <AccountingWriteContext.Provider value={service}>
      {children}
    </AccountingWriteContext.Provider>
  );
}

export function useAccountingWriteService(): JournalWriteService | null {
  const service = useContext(AccountingWriteContext);
  return service ?? null;
}
