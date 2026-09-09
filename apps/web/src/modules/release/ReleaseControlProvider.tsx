import { createContext, useContext, type ReactNode } from 'react';
import type { ReleaseControllerService } from '../../../../../packages/release-control/src';

const ReleaseControlContext = createContext<ReleaseControllerService | null>(null);

export function ReleaseControlProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: ReleaseControllerService | null;
}) {
  return (
    <ReleaseControlContext.Provider value={service}>
      {children}
    </ReleaseControlContext.Provider>
  );
}

export function useReleaseControl() {
  return useContext(ReleaseControlContext);
}
