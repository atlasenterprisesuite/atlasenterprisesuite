import { createContext, useContext, type ReactNode } from 'react';
import type { TenantScope } from '../../../../../packages/core/src';

export type AtlasRuntimeContext = {
  scope: TenantScope;
  actorId: string;
  environment: 'demo' | 'configured' | 'live';
};

const defaultContext: AtlasRuntimeContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' },
  actorId: 'demo-user',
  environment: 'demo'
};

const AtlasContext = createContext<AtlasRuntimeContext>(defaultContext);

export function AtlasProvider({ children }: { children: ReactNode }) {
  return <AtlasContext.Provider value={defaultContext}>{children}</AtlasContext.Provider>;
}

export function useAtlasContext() {
  return useContext(AtlasContext);
}
