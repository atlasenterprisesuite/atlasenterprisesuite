import { createContext, useContext, type ReactNode } from 'react';

export type AtlasEnvironmentMode = 'demo';

export interface AtlasContextValue {
  mode: AtlasEnvironmentMode;
  tenantId: string;
  organizationId: string;
  organizationName: string;
  userDisplayName: string;
}

const demoContext: AtlasContextValue = {
  mode: 'demo',
  tenantId: 'atlas-demo-tenant',
  organizationId: 'atlas-demo-organization',
  organizationName: 'ATLAS Demo Organization',
  userDisplayName: 'Demo Operator',
};

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  return <AtlasContext.Provider value={demoContext}>{children}</AtlasContext.Provider>;
}

export function useAtlasContext() {
  const context = useContext(AtlasContext);

  if (!context) {
    throw new Error('ATLAS context must be used inside AtlasProvider');
  }

  return context;
}
