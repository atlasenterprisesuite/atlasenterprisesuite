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
