import { createContext, useContext, type ReactNode } from 'react';
import type { PeoplePayrollWriteService } from '../../../../../packages/people/src';

const PeoplePayrollWriteContext = createContext<PeoplePayrollWriteService | null | undefined>(undefined);

export function PeoplePayrollWriteProvider({
  service,
  children,
}: {
  service: PeoplePayrollWriteService | null;
  children: ReactNode;
}) {
  return (
    <PeoplePayrollWriteContext.Provider value={service}>
      {children}
    </PeoplePayrollWriteContext.Provider>
  );
}

export function usePeoplePayrollWriteService(): PeoplePayrollWriteService | null {
  return useContext(PeoplePayrollWriteContext) ?? null;
}
