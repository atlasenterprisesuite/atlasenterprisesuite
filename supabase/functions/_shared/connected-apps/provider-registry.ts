import {
  validateProviderManifest,
  type ProviderManifest
} from '../../../../packages/connected-apps/src/index.ts';
import { HUBSPOT_P0_SCOPES } from '../hubspot-connection-lifecycle.ts';

const manifests: readonly ProviderManifest[] = [
  validateProviderManifest({
    providerId: 'hubspot',
    displayName: 'HubSpot',
    authKinds: ['oauth2'],
    runtimeStatus: 'ready',
    capabilities: [
      { code: 'crm.oauth', accessLevel: 'admin', providerScopes: ['oauth'] },
      { code: 'crm.contacts.read', accessLevel: 'read', providerScopes: ['crm.objects.contacts.read'] },
      { code: 'crm.companies.read', accessLevel: 'read', providerScopes: ['crm.objects.companies.read'] },
      { code: 'crm.deals.read', accessLevel: 'read', providerScopes: ['crm.objects.deals.read'] },
      { code: 'crm.tickets.read', accessLevel: 'read', providerScopes: ['crm.objects.tickets.read'] }
    ],
    supportsReadinessProbe: true,
    supportsTokenRefresh: true,
    supportsDisconnect: true,
    supportsDeletionRequest: false,
    adapterVersion: 1
  }),
  validateProviderManifest({
    providerId: 'google', displayName: 'Google Workspace', authKinds: ['oauth2'], runtimeStatus: 'catalog_only',
    capabilities: [
      { code: 'mail.read', accessLevel: 'read', providerScopes: ['gmail.read'] },
      { code: 'mail.send', accessLevel: 'consequential', providerScopes: ['gmail.send'] },
      { code: 'calendar.read', accessLevel: 'read', providerScopes: ['calendar.read'] },
      { code: 'calendar.write', accessLevel: 'consequential', providerScopes: ['calendar.write'] },
      { code: 'files.read', accessLevel: 'read', providerScopes: ['drive.read'] },
      { code: 'contacts.read', accessLevel: 'read', providerScopes: ['contacts.read'] }
    ],
    supportsReadinessProbe: false, supportsTokenRefresh: false, supportsDisconnect: false, supportsDeletionRequest: false, adapterVersion: 1
  }),
  validateProviderManifest({
    providerId: 'microsoft', displayName: 'Microsoft 365', authKinds: ['oauth2'], runtimeStatus: 'catalog_only',
    capabilities: [
      { code: 'mail.read', accessLevel: 'read', providerScopes: ['Mail.Read'] },
      { code: 'calendar.read', accessLevel: 'read', providerScopes: ['Calendars.Read'] },
      { code: 'files.read', accessLevel: 'read', providerScopes: ['Files.Read'] }
    ],
    supportsReadinessProbe: false, supportsTokenRefresh: false, supportsDisconnect: false, supportsDeletionRequest: false, adapterVersion: 1
  }),
  validateProviderManifest({
    providerId: 'github', displayName: 'GitHub', authKinds: ['oauth2'], runtimeStatus: 'catalog_only',
    capabilities: [
      { code: 'repo.read', accessLevel: 'read', providerScopes: ['repo:read'] },
      { code: 'repo.pr.write', accessLevel: 'consequential', providerScopes: ['repo:write'] }
    ],
    supportsReadinessProbe: false, supportsTokenRefresh: false, supportsDisconnect: false, supportsDeletionRequest: false, adapterVersion: 1
  }),
  validateProviderManifest({
    providerId: 'slack', displayName: 'Slack', authKinds: ['oauth2'], runtimeStatus: 'catalog_only',
    capabilities: [
      { code: 'messages.read', accessLevel: 'read', providerScopes: ['channels:history'] },
      { code: 'messages.send', accessLevel: 'consequential', providerScopes: ['chat:write'] }
    ],
    supportsReadinessProbe: false, supportsTokenRefresh: false, supportsDisconnect: false, supportsDeletionRequest: false, adapterVersion: 1
  }),
  validateProviderManifest({
    providerId: 'dropbox', displayName: 'Dropbox', authKinds: ['oauth2'], runtimeStatus: 'catalog_only',
    capabilities: [
      { code: 'files.read', accessLevel: 'read', providerScopes: ['files.content.read'] },
      { code: 'files.write', accessLevel: 'consequential', providerScopes: ['files.content.write'] }
    ],
    supportsReadinessProbe: false, supportsTokenRefresh: false, supportsDisconnect: false, supportsDeletionRequest: false, adapterVersion: 1
  })
];

if (HUBSPOT_P0_SCOPES.some((scope) => !manifests[0].capabilities.some((capability) => capability.providerScopes.includes(scope)))) {
  throw new Error('hubspot_manifest_scope_mismatch');
}

export function listProviderManifests(): readonly ProviderManifest[] {
  return manifests;
}

export function getProviderManifest(providerId: string): ProviderManifest | null {
  return manifests.find((manifest) => manifest.providerId === providerId) ?? null;
}
