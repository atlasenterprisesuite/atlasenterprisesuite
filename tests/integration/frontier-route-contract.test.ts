import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const resolver = readFileSync(`${process.cwd()}/apps/web/src/extensions/resolveAtlasExtension.tsx`, 'utf8');
const dashboard = readFileSync(`${process.cwd()}/apps/web/src/modules/experience/AtlasModuleExperiences.tsx`, 'utf8');
const api = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/api.ts`, 'utf8');
const routes = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/FrontierRoutes.tsx`, 'utf8');

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

  it('loads durable campaign, ecology, expansion and spatial world state', () => {
    expect(api).toContain('campaign_stage');
    expect(api).toContain('/rest/v1/frontier_ecology?');
    expect(api).toContain('/rest/v1/frontier_expansion?');
    expect(api).toContain('campaign_complete');
    expect(api).toContain('/rest/v1/frontier_structures?');
  });

  it('routes advanced campaign mutations only through governed controllers', () => {
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_ecology_action'");
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_expansion_action'");
    expect(api).not.toContain('/rest/v1/frontier_ecology?on_conflict');
    expect(api).not.toContain('/rest/v1/frontier_expansion?on_conflict');
    expect(api).not.toContain('/rest/v1/frontier_expansion_events?on_conflict');
  });

  it('keeps spatial builds on the dedicated governed placement RPC', () => {
    expect(api).toContain("p_structure_type: 'habitat'");
    expect(api).toContain('position_x');
    expect(api).toContain('rotation_y');
  });

  it('surfaces forty-level and endless-mode evidence in the player UI', () => {
    expect(routes).toContain('40-LEVEL CAMPAIGN');
    expect(routes).toContain('LEVEL');
    expect(routes).toContain('/40');
    expect(routes).toContain('CAMPAIGN SPINE COMPLETE');
    expect(routes).toContain('Endless cycle');
  });
});
