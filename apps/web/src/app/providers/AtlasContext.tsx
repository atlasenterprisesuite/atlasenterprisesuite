import { createContext, useContext, type ReactNode } from 'react';
import {
  demoAtlasContext,
  type AccountingPermission,
  type TenantScope
} from '../../../../../packages/core/src';

export type AtlasContextValue = {
  scope: TenantScope;
  actorId: string;
  permissions: AccountingPermission[];
  environment: 'demo' | 'production';
};

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasContextProvider({
  children,
  value = demoAtlasContext
}: {
  children: ReactNode;
  value?: AtlasContextValue;
}) {
  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlasContext() {
  const context = useContext(AtlasContext);
  if (!context) {
    throw new Error('useAtlasContext must be used inside AtlasContextProvider');
  }
  return context;
}
