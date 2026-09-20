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

  it('sends core gameplay writes only through governed RPCs', () => {
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_action'");
    expect(api).toContain("'/rest/v1/rpc/frontier_build_structure'");
    expect(api).not.toContain('/rest/v1/frontier_runs?on_conflict');
    expect(api).not.toContain('/rest/v1/frontier_structures?on_conflict');
  });

  it('loads durable campaign, ecology and spatial world state', () => {
    expect(api).toContain('campaign_stage');
    expect(api).toContain('experience');
    expect(api).toContain('/rest/v1/frontier_structures?');
    expect(api).toContain('/rest/v1/frontier_ecology?');
    expect(api).toContain('ecosystem_stability');
    expect(api).toContain('restored_biomes');
  });

  it('routes Living Worlds mutations only through the Living Systems Controller', () => {
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_ecology_action'");
    expect(api).not.toContain('/rest/v1/frontier_ecology?on_conflict');
    expect(api).not.toContain('/rest/v1/frontier_ecology_events?on_conflict');
  });

  it('keeps spatial builds on the dedicated governed placement RPC', () => {
    expect(api).toContain("p_structure_type: 'habitat'");
    expect(api).toContain('position_x');
    expect(api).toContain('rotation_y');
  });
});
