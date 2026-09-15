import {
  DEFAULT_ORGANIZATION_OS_POLICY,
  DEFAULT_PERSONAL_OS_SETTINGS,
  normalizeOrganizationOsPolicy,
  normalizePersonalOsSettings,
  type OrganizationOsPolicy,
  type PersonalOsSettings
} from '../../../../../packages/core/src/os-settings';
import { authorizedAtlasFetch } from '../../lib/atlasSession';

export type OsSettingsSnapshot = {
  organizationId: string;
  role: string;
  personal: PersonalOsSettings;
  personalVersion: number;
  organization: OrganizationOsPolicy;
  organizationVersion: number;
  externalDelivery: Record<'windows' | 'macos' | 'ios' | 'android', 'not_verified' | 'verified'>;
};

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    body = { message: text || 'invalid_response' };
  }
  if (!response.ok) {
    const message = String(body.message || body.error || body.hint || `Request failed (${response.status})`);
    const normalized = message.includes('version_conflict') ? 'version_conflict' : message;
    throw new Error(normalized);
  }
  return body;
}

function snapshot(body: Record<string, unknown>): OsSettingsSnapshot {
  const externalRaw = body.external_delivery && typeof body.external_delivery === 'object'
    ? body.external_delivery as Record<string, unknown>
    : {};
  const externalDelivery = {
    windows: externalRaw.windows === 'verified' ? 'verified' : 'not_verified',
    macos: externalRaw.macos === 'verified' ? 'verified' : 'not_verified',
    ios: externalRaw.ios === 'verified' ? 'verified' : 'not_verified',
    android: externalRaw.android === 'verified' ? 'verified' : 'not_verified'
  } as const;

  return {
    organizationId: String(body['organization_id'] || ''),
    role: String(body.role || 'member'),
    personal: normalizePersonalOsSettings(body.personal || DEFAULT_PERSONAL_OS_SETTINGS),
    personalVersion: Math.max(0, Number(body.personal_version || 0)),
    organization: normalizeOrganizationOsPolicy(body.organization || DEFAULT_ORGANIZATION_OS_POLICY),
    organizationVersion: Math.max(0, Number(body.organization_version || 0)),
    externalDelivery
  };
}

export async function getOsSettings(): Promise<OsSettingsSnapshot> {
  const response = await authorizedAtlasFetch('/rest/v1/rpc/get_os_settings', {
    method: 'POST',
    body: '{}'
  });
  return snapshot(await parseResponse(response));
}

export async function savePersonalOsSettings(
  settings: PersonalOsSettings,
  expectedVersion: number
): Promise<OsSettingsSnapshot> {
  const response = await authorizedAtlasFetch('/rest/v1/rpc/update_os_settings', {
    method: 'POST',
    body: JSON.stringify({
      p_scope: 'user',
      p_settings: normalizePersonalOsSettings(settings),
      p_expected_version: expectedVersion
    })
  });
  return snapshot(await parseResponse(response));
}

export async function saveOrganizationOsPolicy(
  settings: OrganizationOsPolicy,
  expectedVersion: number
): Promise<OsSettingsSnapshot> {
  const response = await authorizedAtlasFetch('/rest/v1/rpc/update_os_settings', {
    method: 'POST',
    body: JSON.stringify({
      p_scope: 'organization',
      p_settings: normalizeOrganizationOsPolicy(settings),
      p_expected_version: expectedVersion
    })
  });
  return snapshot(await parseResponse(response));
}
