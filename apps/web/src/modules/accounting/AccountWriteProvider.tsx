import { createContext, useContext, type ReactNode } from 'react';
import type { AccountWriteService } from '../../../../../packages/accounting/src';

const AccountWriteContext = createContext<AccountWriteService | null | undefined>(undefined);

export function AccountWriteProvider({
  service,
  children,
}: {
  service: AccountWriteService | null;
  children: ReactNode;
}) {
  return (
    <AccountWriteContext.Provider value={service}>
      {children}
    </AccountWriteContext.Provider>
  );
}

export function useAccountWriteService(): AccountWriteService | null {
  const service = useContext(AccountWriteContext);
  return service ?? null;
}
