import { describe, expect, it } from 'vitest';
import { resolveAssistantModule } from '../../apps/web/src/assistant/routeContext';
import { ATLAS_NAV_ITEMS } from '../../apps/web/src/modules/registry';
import {
  ATLAS_AI_WORKSPACE_NAVIGATION,
  ATLAS_AI_WORKSPACE_NODE_IDS,
  ATLAS_NAVIGATION_GRAPH,
  getAtlasAIWorkspaceNode,
  getAtlasNavigationInstructions,
  getAtlasNavigationNode,
  getAtlasNavigationTrail,
  isAtlasAIWorkspacePath,
  searchAtlasNavigation
} from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS navigation intelligence', () => {
  it('prevents visible menu items from drifting outside the canonical graph', () => {
    for (const item of ATLAS_NAV_ITEMS) {
      expect(ATLAS_NAVIGATION_GRAPH.some((node) => node.to === item.to), item.to).toBe(true);
    }
  });

  it('keeps GPS 4D discoverable through the canonical graph', () => {
    const gps = ATLAS_NAVIGATION_GRAPH.find((node) => node.id === 'gps');
    expect(gps?.to).toBe('/gps');
    expect(searchAtlasNavigation('map')[0]?.id).toBe('gps');
  });

  it('resolves accounting deep links into a usable menu trail', () => {
    const node = getAtlasNavigationNode('/finance/accounting/accounts-payable');
    expect(node?.id).toBe('payables');
    expect(getAtlasNavigationTrail('/finance/accounting/accounts-payable').map((item) => item.id)).toEqual([
      'home',
      'accounting',
      'payables'
    ]);
    expect(getAtlasNavigationInstructions('/finance/accounting/accounts-payable')).toBe(
      'Home → Accounting → Payables'
    );
  });

  it('searches English and Spanish operational aliases', () => {
    expect(searchAtlasNavigation('cuentas por cobrar')[0]?.id).toBe('receivables');
    expect(searchAtlasNavigation('proveedores')[0]?.id).toBe('payables');
    expect(searchAtlasNavigation('accesibilidad')[0]?.id).toBe('accessibility');
  });

  it('feeds canonical navigation context into the assistant for routes not hard-coded there', () => {
    expect(resolveAssistantModule('/gps')).toBe('gps');
    expect(resolveAssistantModule('/cloud')).toBe('cloud');
  });

  it('keeps every parent relationship resolvable', () => {
    for (const node of ATLAS_NAVIGATION_GRAPH) {
      if (!node.parentId) continue;
      expect(ATLAS_NAVIGATION_GRAPH.some((candidate) => candidate.id === node.parentId), node.id).toBe(true);
    }
  });

  it('fails truthfully for unknown routes and descendants instead of inventing navigation', () => {
    expect(getAtlasNavigationNode('/does-not-exist')).toBeUndefined();
    expect(getAtlasNavigationNode('/gps/missing')).toBeUndefined();
    expect(getAtlasNavigationNode('/finance/accounting/accounts-payable/missing')).toBeUndefined();
    expect(getAtlasNavigationInstructions('/does-not-exist')).toBe('');
    expect(getAtlasNavigationInstructions('/gps/missing')).toBe('');
    expect(getAtlasNavigationInstructions('/settings/accessibility/communication')).toBe('Home → Accessibility');
  });

  it('derives the Wave 1 AI workspace from canonical graph nodes only', () => {
    expect(ATLAS_AI_WORKSPACE_NODE_IDS).toEqual([
      'assistant',
      'work',
      'studio',
      'ai-universe',
      'studio-create',
      'creator-library',
      'provider-readiness',
      'voice'
    ]);
    expect(ATLAS_AI_WORKSPACE_NAVIGATION.map((node) => node.id)).toEqual(ATLAS_AI_WORKSPACE_NODE_IDS);
    for (const node of ATLAS_AI_WORKSPACE_NAVIGATION) {
      expect(ATLAS_NAVIGATION_GRAPH.includes(node), node.id).toBe(true);
    }
  });

  it('maps only real Wave 1 AI destinations and preserves create query intent', () => {
    expect(getAtlasAIWorkspaceNode('/assistant')?.id).toBe('assistant');
    expect(getAtlasAIWorkspaceNode('/work')?.id).toBe('work');
    expect(getAtlasAIWorkspaceNode('/studio')?.id).toBe('studio');
    expect(getAtlasAIWorkspaceNode('/studio/ai-universe')?.id).toBe('ai-universe');
    expect(getAtlasAIWorkspaceNode('/studio/create')?.id).toBe('studio-create');
    expect(getAtlasAIWorkspaceNode('/studio/create?type=image')?.to).toBe('/studio/create?type=image');
    expect(getAtlasAIWorkspaceNode('/studio/library')?.id).toBe('creator-library');
    expect(getAtlasAIWorkspaceNode('/studio/providers')?.id).toBe('provider-readiness');
    expect(getAtlasAIWorkspaceNode('/voice')?.id).toBe('voice');
    expect(getAtlasAIWorkspaceNode('/studio/voice')?.id).toBe('voice');
  });

  it('keeps AI workspace aliases exact and fail closed', () => {
    expect(isAtlasAIWorkspacePath('/studio/voice')).toBe(true);
    expect(getAtlasAIWorkspaceNode('/studio/create/missing')).toBeUndefined();
    expect(getAtlasAIWorkspaceNode('/projects')).toBeUndefined();
    expect(getAtlasAIWorkspaceNode('/skills')).toBeUndefined();
    expect(getAtlasAIWorkspaceNode('/does-not-exist')).toBeUndefined();
    expect(isAtlasAIWorkspacePath('/studio/create/missing')).toBe(false);
  });

  it('keeps AI child parent relationships resolvable and route keys unique', () => {
    for (const id of ['ai-universe', 'studio-create', 'creator-library', 'provider-readiness']) {
      const node = ATLAS_NAVIGATION_GRAPH.find((candidate) => candidate.id === id);
      expect(node?.parentId).toBe('studio');
      expect(ATLAS_NAVIGATION_GRAPH.some((candidate) => candidate.id === node?.parentId)).toBe(true);
    }

    const ids = ATLAS_NAVIGATION_GRAPH.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routeKeys = ATLAS_NAVIGATION_GRAPH.map((node) => node.to);
    expect(new Set(routeKeys).size).toBe(routeKeys.length);
  });
});