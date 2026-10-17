/**
 * ATLAS Domains: identity-bound client for the future trusted DNS API.
 * Uses the existing ATLAS session and organization membership resolution.
 * Does not enable writes until a server endpoint is explicitly configured.
 */
import { getActiveAtlasOrganization, getAtlasAccessToken } from '../../../lib/atlasSession';

export type DnsRecord = {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'CAA';
  value: string;
  ttl?: number;
  priority?: number;
};
export type DnsZoneSnapshot = {
  tenantId: string;
  zone: string;
  version: number;
  records: DnsRecord[];
};
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
function requireDnsApiUrl() {
  const url = import.meta.env.VITE_ATLAS_DNS_API_URL;
  if (!url || typeof url !== 'string') throw new Error('dns_api_not_configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error('dns_api_invalid_configuration');
  return parsed.origin + parsed.pathname.replace(/\/$/, '');
}
async function requestZone(zoneName: string, method: 'GET' | 'PUT', body?: unknown) {
  const zone = zoneName.trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(zone)) throw new Error('invalid_zone_name');
  const organization = await getActiveAtlasOrganization();
  const token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  const apiUrl = requireDnsApiUrl();
  const response = await fetch(`${apiUrl}/organizations/${encodeURIComponent(organization.id)}/dns/zones/${encodeURIComponent(zone)}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    cache:'no-store'
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`dns_request_failed_${response.status}`);
  return data as {zone: DnsZoneSnapshot | null};
}
export async function getAtlasDnsZone(zoneName: string) {
  return requestZone(zoneName, 'GET');
}
export async function saveAtlasDnsZone(zoneName: string, records: DnsRecord[], expectedVersion: number) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error('invalid_expected_version');
  return requestZone(zoneName, 'PUT', {records,expectedVersion});
}
