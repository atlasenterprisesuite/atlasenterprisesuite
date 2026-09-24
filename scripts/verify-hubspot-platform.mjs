import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASELINE_DATE = Date.parse('2026-09-15T23:59:59Z');
const CHANGELOG_URL = 'https://developers.hubspot.com/changelog';
const REQUIRED_URLS = [
  CHANGELOG_URL,
  'https://developers.hubspot.com/changelog/v1-oauth-api-deprecation',
  'https://developers.hubspot.com/changelog/fall-2026-spotlight?hs_amp=true'
];

const localChecks = [
  {
    path: 'supabase/functions/_shared/hubspot-oauth.ts',
    mustContain: [
      '/oauth/2026-03/token',
      '/oauth/2026-03/token/introspect',
      '/oauth/2026-03/token/revoke'
    ],
    mustNotContain: ['/oauth/v1/', '/v1/access-tokens/', '/v1/refresh-tokens/']
  },
  {
    path: 'supabase/functions/_shared/hubspot-crm.ts',
    mustContain: ['/crm/objects/2026-03'],
    mustNotContain: ['/crm/v3/']
  },
  {
    path: 'hubspot/atlas-crm-hubspot/hsproject.json',
    mustContain: ['"platformVersion": "2026.09"'],
    mustNotContain: []
  },
  {
    path: 'hubspot/atlas-crm-hubspot/src/app/app-hsmeta.json',
    mustContain: ['crm.objects.tickets.read'],
    mustNotContain: ['"tickets"']
  }
];

const RISK_TERMS = [
  'oauth',
  'webhook',
  'scope',
  'developer platform',
  'private app',
  'crm objects',
  'crm object',
  'authentication',
  'client secret'
];

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:h\d|p|div|li|article|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function relevantNewEntries(text) {
  const findings = [];
  const datePattern = /(?:Announced|Live):\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/g;
  for (const match of text.matchAll(datePattern)) {
    const timestamp = Date.parse(match[1]);
    if (!Number.isFinite(timestamp) || timestamp <= BASELINE_DATE) continue;
    const start = Math.max(0, (match.index ?? 0) - 700);
    const end = Math.min(text.length, (match.index ?? 0) + 1200);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
    const lower = context.toLowerCase();
    const terms = RISK_TERMS.filter((term) => lower.includes(term));
    if (terms.length === 0) continue;
    findings.push({ date: match[1], terms, context: context.slice(0, 1200) });
  }
  return findings;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'ATLAS-HubSpot-Platform-Watch/1.0' },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HubSpot source unavailable (${response.status}): ${url}`);
  return response.text();
}

const localFailures = [];
for (const check of localChecks) {
  const content = await readFile(check.path, 'utf8');
  for (const value of check.mustContain) {
    if (!content.includes(value)) localFailures.push(`${check.path}: missing ${value}`);
  }
  for (const value of check.mustNotContain) {
    if (content.includes(value)) localFailures.push(`${check.path}: deprecated contract present ${value}`);
  }
}

const fetched = {};
for (const url of REQUIRED_URLS) fetched[url] = await fetchText(url);
const changelogText = toText(fetched[CHANGELOG_URL]);
const relevant = relevantNewEntries(changelogText);
const report = {
  generatedAt: new Date().toISOString(),
  baseline: new Date(BASELINE_DATE).toISOString(),
  localFailures,
  relevantNewEntries: relevant,
  sourceDigest: createHash('sha256').update(changelogText).digest('hex')
};

await mkdir('.tmp', { recursive: true });
await writeFile('.tmp/hubspot-platform-watch.json', JSON.stringify(report, null, 2) + '\n');

console.log(JSON.stringify(report, null, 2));
if (localFailures.length || relevant.length) process.exit(2);
