import { createContext, useContext, type ReactNode } from 'react';
import type { ArApWriteService } from '../../../../../packages/accounting/src';

const ArApWriteContext = createContext<ArApWriteService | null | undefined>(undefined);

export function ArApWriteProvider({
  service,
  children,
}: {
  service: ArApWriteService | null;
  children: ReactNode;
}) {
  return (
    <ArApWriteContext.Provider value={service}>
      {children}
    </ArApWriteContext.Provider>
  );
}

export function useArApWriteService(): ArApWriteService | null {
  const service = useContext(ArApWriteContext);
  return service ?? null;
}
