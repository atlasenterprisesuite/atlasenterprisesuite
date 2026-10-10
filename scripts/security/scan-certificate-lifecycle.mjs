import fs from 'node:fs';
import { evaluateClientCertificateInventory } from './certificate-lifecycle.mjs';

const API = 'https://api.cloudflare.com/client/v4';
const ZONE_NAME = 'atlasenterprisesuite.com';
const HOSTNAME = 'www.atlasenterprisesuite.com';

function stop(code) { const error = new Error(code); error.code = code; throw error; }
async function providerGet(path, token) {
  const response = await fetch(API + path, {
    method: 'GET',
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) stop('cloudflare_read_failed');
  const data = await response.json().catch(() => null);
  if (!data || data.success !== true) stop('cloudflare_read_failed');
  return data;
}

function addSummary(report) {
  const destination = process.env.GITHUB_STEP_SUMMARY;
  if (!destination) return;
  fs.appendFileSync(destination, [
    '### ATLAS Certificate Lifecycle & Trust Management',
    '- Evidence: Cloudflare API read-only zone inventory',
    '- Status: ' + report.status,
    '- Active certificates: ' + report.counts.active,
    '- Expiring within 30 days: ' + report.counts.expiring,
    '- Critical within 7 days: ' + report.counts.critical,
    '- Expired: ' + report.counts.expired,
    '- Invalid metadata: ' + report.counts.invalid,
    '- Provider/ATLAS agent binding reconciliation: NOT VERIFIED',
    '- Automated certificate issuance: DISABLED (device-generated CSR required)',
    '- No private keys, CSRs, PEMs, certificate IDs or fingerprints exported.',
    '',
  ].join('\n'));
}

async function main() {
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!token) stop('cloudflare_token_unavailable');
  const zones = await providerGet('/zones?name=' + encodeURIComponent(ZONE_NAME) + '&status=active', token);
  if (!Array.isArray(zones.result) || zones.result.length !== 1 || !/^[a-f0-9]{32}$/.test(zones.result[0].id)) {
    stop('cloudflare_zone_ambiguous');
  }
  const zoneId = zones.result[0].id;
  const associations = await providerGet('/zones/' + zoneId + '/certificate_authorities/hostname_associations', token);
  const pages = [];
  for (let page = 1; page <= 100; page++) {
    const result = await providerGet('/zones/' + zoneId + '/client_certificates?status=all&per_page=50&page=' + page, token);
    pages.push(result);
    if (!Number.isSafeInteger(result.result_info?.total_pages) || result.result_info.total_pages > 100) stop('inventory_incomplete');
    if (page >= result.result_info.total_pages) break;
  }
  const report = evaluateClientCertificateInventory({ pages, hostnameAssociations: associations }, {
    now: new Date(), hostname: HOSTNAME,
  });
  console.log(JSON.stringify(report));
  addSummary(report);
  if (report.status === 'blocked') process.exitCode = 2;
}

main().catch(error => {
  const safeCodes = new Set(['cloudflare_token_unavailable','cloudflare_read_failed','cloudflare_zone_ambiguous','inventory_incomplete',
    'invalid_audit_options']);
  const code = safeCodes.has(error?.code || error?.message) ? (error?.code || error?.message) : 'certificate_audit_failed';
  console.error(JSON.stringify({ status: 'blocked', error: code, verified: false }));
  process.exitCode = 2;
});
