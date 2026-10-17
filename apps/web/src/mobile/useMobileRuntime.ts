import { useEffect, useState } from 'react';
import type { MobileRuntimeSnapshot } from '../../../../packages/mobile-experience';
import { createUnverifiedMobileStatus, getMobileStatus, type MobileStatusResponse } from './client';
import { captureWebRuntime } from './runtime';

export type MobileRuntimeHookState = {
  status: 'loading' | 'ready' | 'error';
  local: MobileRuntimeSnapshot;
  server: MobileStatusResponse | null;
  error: string | null;
  stale: boolean;
};

export function useMobileRuntime(): MobileRuntimeHookState {
  const [state, setState] = useState<MobileRuntimeHookState>(() => ({
    status: 'loading',
    local: captureWebRuntime(),
    server: null,
    error: null,
    stale: false
  }));

  useEffect(() => {
    let cancelled = false;
    const local = captureWebRuntime();
    setState({ status: 'loading', local, server: null, error: null, stale: false });

    void getMobileStatus()
      .then((server) => {
        if (cancelled) return;
        setState({ status: 'ready', local, server, error: null, stale: false });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          local,
          server: createUnverifiedMobileStatus(),
          error: error instanceof Error ? error.message : 'mobile_status_unavailable',
          stale: true
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
