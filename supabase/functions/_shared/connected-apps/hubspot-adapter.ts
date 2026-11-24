// Thin compatibility bridge only. The canonical HubSpot OAuth, readiness,
// credential-vault and revoke behavior stays in hubspot-connection-lifecycle.
export {
  HUBSPOT_P0_SCOPES,
  prepareHubSpotConnection,
  completeHubSpotConnection,
  getHubSpotConnectionStatus,
  disconnectHubSpotConnection
} from '../hubspot-connection-lifecycle.ts';

export const HUBSPOT_CONNECTED_APPS_ADAPTER = {
  providerId: 'hubspot',
  runtime: 'atlas-crm-hubspot'
} as const;
