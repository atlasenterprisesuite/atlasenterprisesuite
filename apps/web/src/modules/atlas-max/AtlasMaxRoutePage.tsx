import React, { useEffect, useState } from 'react';
import { getAssistantStatus, getAssistantUsage } from '../../assistant/client';
import { ATLAS_SESSION_EVENT, getActiveAtlasOrganization } from '../../lib/atlasSession';
import { AtlasMaxPage } from './AtlasMaxPage';
import { deriveAtlasMaxGatewaySnapshot } from './gatewaySnapshot';
import type { AtlasMaxGatewayPanelState } from './GatewayPanel';

const UNAVAILABLE_GATEWAY: AtlasMaxGatewayPanelState = {
  state: 'unavailable',
  verifiedProviders: [],
  requests: null,
  usageScope: null,
  checkedAt: null
};

/**
 * Route-only authenticated read path. The product catalog remains visible if
 * the gateway is unavailable; no API result can activate a MAX entitlement.
 */
export function AtlasMaxRoutePage() {
  const [revision, setRevision] = useState(0);
  const [gateway, setGateway] = useState<AtlasMaxGatewayPanelState>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const onSessionChange = () => setRevision((value) => value + 1);

    window.addEventListener(ATLAS_SESSION_EVENT, onSessionChange);
    setGateway({ state: 'loading' });

    void (async () => {
      try {
        const before = await getActiveAtlasOrganization();
        const [statusResult, usageResult] = await Promise.allSettled([
          getAssistantStatus(),
          getAssistantUsage(30)
        ]);
        const after = await getActiveAtlasOrganization();

        if (cancelled) return;
        if (before.id !== after.id || statusResult.status !== 'fulfilled') {
          setGateway(UNAVAILABLE_GATEWAY);
          return;
        }

        const snapshot = deriveAtlasMaxGatewaySnapshot(
          before.id,
          statusResult.value,
          usageResult.status === 'fulfilled' ? usageResult.value : null
        );
        setGateway(snapshot);
      } catch {
        if (!cancelled) setGateway(UNAVAILABLE_GATEWAY);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(ATLAS_SESSION_EVENT, onSessionChange);
    };
  }, [revision]);

  return <AtlasMaxPage
    entitlement={{ status: 'unknown' }}
    usage={{ used: 0, limit: 0 }}
    gateway={gateway}
    onGatewayRefresh={() => setRevision((value) => value + 1)}
  />;
}
