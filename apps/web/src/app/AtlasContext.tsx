import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
      userEmail?: string;
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
  signIn?(email: string, password: string): Promise<void>;
  signOut?(): Promise<void>;
  subscribe?(listener: () => void): () => void;
}

export interface AtlasInteractiveIdentitySource extends AtlasIdentitySource {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export type AtlasSessionActions = Readonly<{
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}>;

const AtlasContext = createContext<AtlasIdentityState | null>(null);
const AtlasSessionActionsContext = createContext<AtlasSessionActions | null>(null);

export function AtlasProvider({ children, source }: { children: ReactNode; source: AtlasIdentitySource }) {
  const [state, setState] = useState<AtlasIdentityState>({ status: 'loading' });

  const resolveIdentity = async () => {
    try {
      setState(await source.resolve());
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to resolve ATLAS identity' });
    }
  };

  useEffect(() => {
    let active = true;
    const resolveActiveIdentity = async () => {
      try {
        const next = await source.resolve();
        if (active) setState(next);
      } catch (error) {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to resolve ATLAS identity' });
      }
    };
    void resolveActiveIdentity();
    const unsubscribe = source.subscribe?.(() => {
      setState({ status: 'loading' });
      void resolveActiveIdentity();
    });
    return () => { active = false; unsubscribe?.(); };
  }, [source]);

  const actions = useMemo<AtlasSessionActions>(() => ({
    async signIn(email, password) {
      if (!source.signIn) throw new Error('authentication_action_unavailable');
      await source.signIn(email, password);
      await resolveIdentity();
    },
    async signOut() {
      if (!source.signOut) throw new Error('authentication_action_unavailable');
      await source.signOut();
      setState({ status: 'authentication_required' });
    },
    async refresh() {
      setState({ status: 'loading' });
      await resolveIdentity();
    },
  }), [source]);

  return (
    <AtlasSessionActionsContext.Provider value={actions}>
      <AtlasContext.Provider value={state}>{children}</AtlasContext.Provider>
    </AtlasSessionActionsContext.Provider>
  );
}

export function useAtlasContext() {
  const context = useContext(AtlasContext);
  if (!context) throw new Error('ATLAS context must be used inside AtlasProvider');
  return context;
}

export function useAtlasSessionActions() {
  const context = useContext(AtlasSessionActionsContext);
  if (!context) throw new Error('ATLAS session actions must be used inside AtlasProvider');
  return context;
}
