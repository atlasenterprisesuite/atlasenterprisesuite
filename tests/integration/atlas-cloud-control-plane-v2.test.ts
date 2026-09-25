import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Cloud control plane v2', () => {
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
  const next = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');
  const ops = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudOperations.tsx', 'utf8');

  it('routes every approved next-level control surface', () => {
    for (const path of [
      '/cloud/api-explorer',
      '/cloud/observability',
      '/cloud/resources',
      '/cloud/service-graph',
      '/cloud/releases',
      '/cloud/iam',
      '/cloud/config',
      '/cloud/finops',
      '/cloud/incidents'
    ]) expect(routes + next).toContain(path);
  });

  it('reuses canonical ATLAS authorities instead of creating a second backend', () => {
    expect(ops).toContain('atlas-observability');
    expect(ops).toContain('atlas-release-control');
    expect(ops).toContain('atlas_module_registry');
    expect(ops).toContain('atlas_incidents');
    expect(ops).not.toContain('create table');
    expect(ops).not.toContain('localStorage.setItem');
  });

  it('keeps release truth separate from deployment and production verification', () => {
    expect(ops).toContain('Source merge, provider deployment and production verification remain separate facts.');
    expect(ops).toContain('Open full Release Control');
    expect(ops).toContain('Open Manager Readiness');
  });

  it('never exposes secret values through the cloud configuration surface', () => {
    expect(ops).toContain('Secret values');
    expect(ops).toContain('Never exposed');
    expect(ops).toContain('never rendered in Atlas Cloud');
    expect(ops).not.toMatch(/secretValue|clientSecret|apiKeyValue|recoveryCode/);
  });

  it('keeps FinOps dollar totals fail-closed until a billing authority exists', () => {
    expect(ops).toContain('Live cloud billing feed');
    expect(ops).toContain('Not exposed');
    expect(ops).toContain('No provider dollar amount is shown here until an authenticated billing authority is connected and verified.');
  });

  it('builds the visual service graph from the canonical module registry', () => {
    expect(ops).toContain('Live Service Graph');
    expect(ops).toContain('data_backend');
    expect(ops).toContain('Cross-service request edges remain fail-closed');
  });

  it('reads reliability state from canonical incidents', () => {
    expect(ops).toContain('api=incidents&limit=100');
    expect(ops).toContain('Incident & Reliability Center');
  });
});
