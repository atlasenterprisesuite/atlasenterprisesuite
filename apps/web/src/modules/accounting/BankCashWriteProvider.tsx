import { createContext, useContext, type ReactNode } from 'react';
import type { BankCashWriteService } from '../../../../../packages/accounting/src';

const BankCashWriteContext = createContext<BankCashWriteService | null | undefined>(undefined);

export function BankCashWriteProvider({
  service,
  children,
}: {
  service: BankCashWriteService | null;
  children: ReactNode;
}) {
  return (
    <BankCashWriteContext.Provider value={service}>
      {children}
    </BankCashWriteContext.Provider>
  );
}

export function useBankCashWriteService(): BankCashWriteService | null {
  return useContext(BankCashWriteContext) ?? null;
}
