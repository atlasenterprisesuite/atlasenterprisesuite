import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const resolver = readFileSync(`${process.cwd()}/apps/web/src/extensions/resolveAtlasExtension.tsx`, 'utf8');
const dashboard = readFileSync(`${process.cwd()}/apps/web/src/modules/experience/AtlasModuleExperiences.tsx`, 'utf8');
const api = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/api.ts`, 'utf8');

describe('ATLAS FRONTIER route contract', () => {
  it('keeps FRONTIER behind ATLAS Identity', () => {
    expect(resolver).toContain("pathname === '/frontier'");
    expect(resolver).toContain('<RequireAtlasIdentity><FrontierRoutes /></RequireAtlasIdentity>');
  });

  it('surfaces FRONTIER from the enterprise dashboard', () => {
    expect(dashboard).toContain("title: 'ATLAS FRONTIER'");
    expect(dashboard).toContain("to: '/frontier'");
  });

  it('sends gameplay writes only through the governed RPC', () => {
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_action'");
    expect(api).not.toContain('/rest/v1/frontier_runs?on_conflict');
  });
});
