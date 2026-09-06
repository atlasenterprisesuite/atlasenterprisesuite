import { createContext, useContext, type ReactNode } from 'react';
import type { CompensationRepository } from '../../../../../packages/people/src';

const CompensationRepositoryContext = createContext<CompensationRepository | null | undefined>(undefined);

export function CompensationRepositoryProvider({
  repository,
  children,
}: {
  repository: CompensationRepository | null;
  children: ReactNode;
}) {
  return (
    <CompensationRepositoryContext.Provider value={repository}>
      {children}
    </CompensationRepositoryContext.Provider>
  );
}

export function useCompensationRepository(): CompensationRepository | null {
  return useContext(CompensationRepositoryContext) ?? null;
}
