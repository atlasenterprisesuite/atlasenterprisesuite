import { createContext, useContext, type ReactNode } from 'react';
import type { PeopleCompensationWriteService } from '../../../../../packages/people/src';

const PeopleCompensationWriteContext = createContext<PeopleCompensationWriteService | null | undefined>(undefined);

export function PeopleCompensationWriteProvider({
  service,
  children,
}: {
  service: PeopleCompensationWriteService | null;
  children: ReactNode;
}) {
  return (
    <PeopleCompensationWriteContext.Provider value={service}>
      {children}
    </PeopleCompensationWriteContext.Provider>
  );
}

export function usePeopleCompensationWriteService(): PeopleCompensationWriteService | null {
  return useContext(PeopleCompensationWriteContext) ?? null;
}
