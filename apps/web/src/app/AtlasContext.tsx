import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AtlasPermission } from '../../../../packages/core/src';

export type AtlasIdentityState =
  | { status: 'loading' }
  | { status: 'configuration_required' }
  | { status: 'authentication_required' }
  | { status: 'organization_required'; userId: string }
  | {
      status: 'ready';
      userId: string;
      tenantId: string;
      tenantName: string;
      organizationId: string;
      organizationName: string;
      role: string;
      permissions: AtlasPermission[];
    }
  | { status: 'error'; message: string };

export interface AtlasIdentitySource {
  resolve(): Promise<AtlasIdentityState>;
  subscribe?(listener: () => void): () => void;
}

const AtlasContext = createContext<AtlasIdentityState | null>(null);

export function AtlasProvider({
  children,
  source,
}: {
  children: ReactNode;
  source: AtlasIdentitySource;
}) {
  const [state, setState] = useState<AtlasIdentityState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const resolveIdentity = async () => {
      try {
        const next = await source.resolve();
        if (active) setState(next);
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to resolve ATLAS identity',
          });
        }
      }
    };

    void resolveIdentity();
    const unsubscribe = source.subscribe?.(() => {
      setState({ status: 'loading' });
      void resolveIdentity();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [source]);

  return <AtlasContext.Provider value={state}>{children}</AtlasContext.Provider>;
}

export function useAtlasContext() {
  const context = useContext(AtlasContext);

  if (!context) {
    throw new Error('ATLAS context must be used inside AtlasProvider');
  }

  return context;
}
