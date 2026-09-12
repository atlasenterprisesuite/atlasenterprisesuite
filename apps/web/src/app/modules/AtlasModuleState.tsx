import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEnabledAtlasModuleCodes } from '../../lib/supabase/moduleStateRepository';
import { useAtlasContext } from '../AtlasContext';

export type AtlasModuleState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; enabledModuleCodes: ReadonlySet<string> }
  | { status: 'error'; message: string };

const AtlasModuleStateContext = createContext<AtlasModuleState>({ status: 'unavailable' });

export function AtlasModuleStateProvider({ children, client }: { children: ReactNode; client: SupabaseClient | null }) {
  const identity = useAtlasContext();
  const [state, setState] = useState<AtlasModuleState>({ status: 'unavailable' });

  useEffect(() => {
    let active = true;

    if (!client || identity.status !== 'ready') {
      setState({ status: 'unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void loadEnabledAtlasModuleCodes(client, identity.tenantId, identity.organizationId)
      .then((enabledModuleCodes) => {
        if (active) setState({ status: 'ready', enabledModuleCodes });
      })
      .catch(() => {
        if (active) setState({ status: 'error', message: 'Unable to resolve organization module state.' });
      });

    return () => { active = false; };
  }, [client, identity]);

  return <AtlasModuleStateContext.Provider value={state}>{children}</AtlasModuleStateContext.Provider>;
}

export function useAtlasModuleState() {
  return useContext(AtlasModuleStateContext);
}
