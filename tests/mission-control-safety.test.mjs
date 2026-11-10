import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../apps/web/src/modules/mission-control/MissionControlPage.tsx', import.meta.url), 'utf8');

test('Mission Control route remains identity-gated', () => {
  assert.match(app, /path="\/mission-control" element=\{<RequireAtlasIdentity><MissionControlPage \/><\/RequireAtlasIdentity>\}/);
});

test('Mission Control explicitly disclaims live status and blocks release', () => {
  assert.match(panel, /not a live feed/);
  assert.match(panel, /GLOBAL: P0 NO-GO/);
  assert.match(panel, /does not authorize merge or deployment/);
});

test('Mission Control links to evidence without using a privileged client token', () => {
  assert.match(panel, /https:\/\/github\.com\/atlasenterprisesuite\/atlasenterprisesuite\/pull\/974/);
  assert.doesNotMatch(panel, /fetch\(|localStorage|service_role|SUPABASE_SERVICE_ROLE_KEY|process\.env/);
});

const identityGate = readFileSync(new URL('../apps/web/src/identity/RequireAtlasIdentity.tsx', import.meta.url), 'utf8');

test('P0 RED: Mission Control must not rely on route identity alone for ledger authorization', () => {
  assert.match(panel, /useMissionControlEvidence|loadMissionControlEvidence|fetchMissionControlEvidence/, 'Missing server-authorized evidence reader');
  assert.match(panel, /permission|capabilit|authorization/i, 'Missing explicit permission handling for ledger read');
});

test('P0 RED: evidence reader must expose denied and unverified states', () => {
  assert.match(panel, /denied|forbidden|unauthorized/i, 'No explicit denied state in Mission Control');
  assert.match(panel, /unverified|unavailable|error/i, 'No explicit unavailable-evidence state in Mission Control');
});

test('P0 baseline: identity guard checks organization, but does not prove ledger authorization', () => {
  assert.match(identityGate, /getActiveAtlasOrganization/);
  assert.doesNotMatch(identityGate, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

const evidenceEndpoint = readFileSync(new URL('../supabase/functions/atlas-mission-control-evidence/index.ts', import.meta.url), 'utf8');

test('P0: CORS preflight rejects untrusted origins without reflecting or substituting an allowed origin', () => {
  assert.match(evidenceEndpoint, /status: origins\.has\(origin\) \? 204 : 403/);
  assert.match(evidenceEndpoint, /\.\.\.\(origins\.has\(origin\) \? \{/);
  assert.doesNotMatch(evidenceEndpoint, /access-control-allow-origin'\s*:\s*origins\.has\([^\n]+\?[^\n]+:\s*'https:\/\//);
});
