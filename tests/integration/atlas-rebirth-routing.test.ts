import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const home = readFileSync('apps/web/src/components/FuturisticEnterpriseHome.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const suite = readFileSync('apps/web/src/modules/integration/AtlasSuitePage.tsx', 'utf8');
const portfolio = readFileSync('apps/web/src/modules/release/portfolio.ts', 'utf8');
const voice = readFileSync('apps/web/src/modules/voice/VoiceStudioPage.tsx', 'utf8');

describe('ATLAS Rebirth routing and convergence', () => {
  it('keeps exact top-level route ownership single-sourced', () => {
    const appRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((route) => route.startsWith('/') && !route.includes(':') && !route.includes('*'));
    const resolverRoutes = [...resolver.matchAll(/pathname\s*===\s*'([^']+)'/g)]
      .map((match) => match[1]);

    expect(appRoutes.filter((route) => resolverRoutes.includes(route))).toEqual([]);
    for (const removed of ['EnterpriseHome', 'BusinessHome', 'FinanceHome', 'AccountingHome', 'HealthHome']) {
      expect(app).not.toContain(`function ${removed}`);
    }
  });

  it('exposes adaptive personalization without changing authorization boundaries', () => {
    expect(app).toContain('path="/settings/personalize"');
    expect(shell).toContain('Personalize ATLAS');
    expect(home).toContain('ATLAS_PERSONALIZATION_EVENT');
    expect(home).toContain('recommendAtlasModules');
    expect(home).toContain('Make ATLAS yours');
  });

  it('keeps merged modules as compatibility identities but removes duplicate primary navigation', () => {
    for (const id of ['automations','bible-os','revenue','accounting','analytics','telecom','site-review','release-control','execution']) {
      const index = registry.indexOf(`id: '${id}'`);
      expect(index).toBeGreaterThan(-1);
      const block = registry.slice(index, registry.indexOf('\n  },', index));
      expect(block).toContain('showInNavigation: false');
    }
    for (const id of ['people', 'insurance']) {
      const index = registry.indexOf(`id: '${id}'`);
      const block = registry.slice(index, registry.indexOf('\n  },', index));
      expect(block).toContain('showInNavigation: true');
    }
  });

  it('surfaces recovered historical capabilities without inventing routes for held concepts', () => {
    expect(suite).toContain('ATLAS_CAPABILITY_CONVERGENCE');
    for (const id of ['parks-global','autowash','latin-command-center','atlas-drive','atlas-cars']) {
      const index = portfolio.indexOf(`id: '${id}'`);
      expect(index).toBeGreaterThan(-1);
      const block = portfolio.slice(index, portfolio.indexOf('\n  },', index));
      expect(block).toContain("state: 'hold'");
    }
  });

  it('uses ATLAS product identity while keeping external voice engines as provider disclosure', () => {
    expect(voice).toContain("import { AtlasVoiceNarration }");
    expect(voice).not.toContain("import { ElevenLabsNarration }");
    expect(voice).toContain('provider-neutral product contract');
  });
});
