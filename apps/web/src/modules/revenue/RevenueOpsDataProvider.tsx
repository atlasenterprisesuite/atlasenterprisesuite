import { createContext, useContext, type ReactNode } from 'react';
import type { RevenueOpsRepository } from '../../../../../packages/revenue-ops/src';

const RevenueOpsRepositoryContext = createContext<RevenueOpsRepository | null>(null);

export function RevenueOpsRepositoryProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository: RevenueOpsRepository | null;
}) {
  return (
    <RevenueOpsRepositoryContext.Provider value={repository}>
      {children}
    </RevenueOpsRepositoryContext.Provider>
  );
}

export function useRevenueOpsRepository() {
  return useContext(RevenueOpsRepositoryContext);
}
