export type TenantScope = {
  tenantId: string;
  organizationId: string;
};

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export type IntegrationPermission =
  | 'integrations.admin'
  | 'google.gmail.read'
  | 'google.gmail.write'
  | 'google.calendar.read'
  | 'google.calendar.write'
  | 'google.drive.read'
  | 'google.drive.write';

export type IntegrationProvider = 'google';

export type IntegrationConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type IntegrationConnection = {
  scope: TenantScope;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
};

const GOOGLE_OAUTH_SCOPES: Record<IntegrationPermission, readonly string[]> = {
  'integrations.admin': [],
  'google.gmail.read': ['https://www.googleapis.com/auth/gmail.readonly'],
  'google.gmail.write': ['https://www.googleapis.com/auth/gmail.compose'],
  'google.calendar.read': [
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.events.freebusy',
    'https://www.googleapis.com/auth/calendar.events.readonly'
  ],
  'google.calendar.write': ['https://www.googleapis.com/auth/calendar.events'],
  'google.drive.read': ['https://www.googleapis.com/auth/drive.readonly'],
  'google.drive.write': ['https://www.googleapis.com/auth/drive.file']
};

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export function hasPermission(
  granted: readonly AccountingPermission[],
  required: AccountingPermission
) {
  return granted.includes(required) || granted.includes('accounting.admin');
}

export function hasIntegrationPermission(
  granted: readonly string[],
  required: IntegrationPermission
) {
  return granted.includes(required) || granted.includes('integrations.admin');
}

export function googleOAuthScopesForPermissions(
  permissions: readonly string[]
): string[] {
  const scopes = new Set<string>();

  for (const permission of permissions) {
    if (!(permission in GOOGLE_OAUTH_SCOPES)) continue;

    for (const scope of GOOGLE_OAUTH_SCOPES[permission as IntegrationPermission]) {
      scopes.add(scope);
    }
  }

  return [...scopes];
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  permissions: readonly string[];
}): string {
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  const state = input.state.trim();

  if (!clientId) throw new Error('Google OAuth client ID is required');
  if (!redirectUri) throw new Error('Google OAuth redirect URI is required');
  if (!state) throw new Error('Google OAuth state is required');

  const scopes = googleOAuthScopesForPermissions(input.permissions);
  if (scopes.length === 0) {
    throw new Error('Google OAuth scope set cannot be empty');
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  return url.toString();
}

export function createIntegrationConnection(input: {
  scope: TenantScope;
  provider: IntegrationProvider;
}): IntegrationConnection {
  return {
    scope: {
      tenantId: input.scope.tenantId,
      organizationId: input.scope.organizationId
    },
    provider: input.provider,
    status: 'disconnected'
  };
}

export function integrationConnectionKey(input: {
  scope: TenantScope;
  provider: IntegrationProvider;
}) {
  return `${input.scope.tenantId}:${input.scope.organizationId}:${input.provider}`;
}

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AccountingPermission[],
  environment: 'demo' as const
};
