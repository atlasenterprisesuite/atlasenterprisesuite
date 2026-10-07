import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import {
  ATLAS_CAPABILITY_CONVERGENCE,
  buildAtlasPortfolio,
  getAtlasPortfolioDecision,
  validateAtlasPortfolio
} from '../../apps/web/src/modules/release/portfolio';

describe('ATLAS Rebirth portfolio', () => {
  it('classifies every canonical module without creating a second route registry', () => {
    const portfolio = buildAtlasPortfolio(ATLAS_MODULES);
    expect(portfolio).toHaveLength(ATLAS_MODULES.length);
    expect(new Set(portfolio.map((item) => item.moduleId)).size).toBe(ATLAS_MODULES.length);
    for (const module of ATLAS_MODULES) {
      expect(portfolio.some((item) => item.moduleId === module.id)).toBe(true);
    }
  });

  it('keeps canonical owners and merges duplicate surfaces into the stronger owner', () => {
    expect(getAtlasPortfolioDecision('automations')).toMatchObject({ disposition: 'merge', ownerModuleId: 'work' });
    expect(getAtlasPortfolioDecision('bible-os')).toMatchObject({ disposition: 'merge', ownerModuleId: 'knowledge' });
    expect(getAtlasPortfolioDecision('accounting')).toMatchObject({ disposition: 'merge', ownerModuleId: 'finance' });
    expect(getAtlasPortfolioDecision('analytics')).toMatchObject({ disposition: 'merge', ownerModuleId: 'business' });
    expect(getAtlasPortfolioDecision('telecom')).toMatchObject({ disposition: 'merge', ownerModuleId: 'connect' });
    expect(getAtlasPortfolioDecision('site-review')).toMatchObject({ disposition: 'merge', ownerModuleId: 'studio' });
    expect(getAtlasPortfolioDecision('release-control')).toMatchObject({ disposition: 'merge', ownerModuleId: 'cloud' });
    expect(getAtlasPortfolioDecision('execution')).toMatchObject({ disposition: 'merge', ownerModuleId: 'work' });
  });

  it('does not retire a canonical module without a declared replacement', () => {
    const portfolio = buildAtlasPortfolio(ATLAS_MODULES);
    for (const item of portfolio.filter((decision) => decision.disposition === 'retire')) {
      expect(item.ownerModuleId).toBeTruthy();
    }
  });

  it('recovers approved embedded capabilities without promoting concepts into fake modules', () => {
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'image-lab',
      state: 'merged',
      ownerModuleId: 'studio'
    }));
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'clean-scan-3d',
      state: 'merged',
      ownerModuleId: 'city'
    }));
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'device-dna',
      state: 'merged',
      ownerModuleId: 'device-os'
    }));
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'mvno-carrier',
      state: 'merged',
      ownerModuleId: 'connect'
    }));
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'parks-global',
      state: 'hold'
    }));
    expect(ATLAS_CAPABILITY_CONVERGENCE).toContainEqual(expect.objectContaining({
      id: 'autowash',
      state: 'hold'
    }));
  });

  it('validates owner references and rejects ownership cycles', () => {
    const result = validateAtlasPortfolio(buildAtlasPortfolio(ATLAS_MODULES), ATLAS_MODULES);
    expect(result.findings).toEqual([]);
    expect(result.blockingFindings).toBe(0);
  });
});
