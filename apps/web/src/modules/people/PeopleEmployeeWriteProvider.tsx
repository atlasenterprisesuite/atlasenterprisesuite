import { createContext, useContext, type ReactNode } from 'react';
import type { PeopleEmployeeWriteService } from '../../../../../packages/people/src';

const PeopleEmployeeWriteContext = createContext<PeopleEmployeeWriteService | null | undefined>(undefined);

export function PeopleEmployeeWriteProvider({
  service,
  children,
}: {
  service: PeopleEmployeeWriteService | null;
  children: ReactNode;
}) {
  return (
    <PeopleEmployeeWriteContext.Provider value={service}>
      {children}
    </PeopleEmployeeWriteContext.Provider>
  );
}

export function usePeopleEmployeeWriteService(): PeopleEmployeeWriteService | null {
  return useContext(PeopleEmployeeWriteContext) ?? null;
}
