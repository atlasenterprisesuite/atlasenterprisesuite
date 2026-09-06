import { createContext, useContext, type ReactNode } from 'react';
import type { PeopleTimeWriteService } from '../../../../../packages/people/src';

const PeopleTimeWriteContext = createContext<PeopleTimeWriteService | null | undefined>(undefined);

export function PeopleTimeWriteProvider({
  service,
  children,
}: {
  service: PeopleTimeWriteService | null;
  children: ReactNode;
}) {
  return (
    <PeopleTimeWriteContext.Provider value={service}>
      {children}
    </PeopleTimeWriteContext.Provider>
  );
}

export function usePeopleTimeWriteService(): PeopleTimeWriteService | null {
  return useContext(PeopleTimeWriteContext) ?? null;
}
