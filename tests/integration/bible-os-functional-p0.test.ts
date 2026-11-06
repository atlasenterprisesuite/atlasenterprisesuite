import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIBLE_OS_SOURCES, BIBLE_OS_VARIANTS } from '../../apps/web/src/modules/knowledge/bible/bibleOsData';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const pagePath = 'apps/web/src/modules/knowledge/bible/BibleOSPage.tsx';
const dataPath = 'apps/web/src/modules/knowledge/bible/bibleOsData.ts';
const resolverPath = 'apps/web/src/extensions/resolveAtlasExtension.tsx';
const registryPath = 'apps/web/src/modules/registry.ts';
const productionContractPath = 'data/ops/global-production-verification.json';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

describe('ATLAS Bible OS functional P0', () => {
  it('ships a dedicated evidence-first Bible OS surface under Knowledge Atlas', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(existsSync(dataPath)).toBe(true);

    const page = read(pagePath);
    const data = read(dataPath);
    const resolver = read(resolverPath);
    const registry = read(registryPath);

    expect(resolver).toContain("import { BibleOSPage } from '../modules/knowledge/bible/BibleOSPage';");
    expect(resolver).toContain("pathname === '/knowledge/bible'");
    expect(resolver).toContain('<RequireAtlasIdentity><BibleOSPage /></RequireAtlasIdentity>');

    expect(registry).toContain("id: 'bible-os'");
    expect(registry).toContain("route: '/knowledge/bible'");
    expect(registry).toContain("showInNavigation: false");

    for (const label of ['Overview', 'Canon Matrix', 'Manuscripts', 'Variant Explorer', 'Relationship Graph']) {
      expect(page, label).toContain(label);
    }

    expect(page).toContain('earliest attainable text');
    expect(page).toContain('not a complete reconstructed Bible');
    expect(page).toContain('Evidence & limitations');

    for (const status of ['DIRECT_WITNESS', 'CRITICAL_RECONSTRUCTION', 'DISPUTED', 'INSUFFICIENT_EVIDENCE']) {
      expect(data, status).toContain(status);
    }

    expect(data).toContain('https://www.uni-muenster.de/INTF/en/');
    expect(data).toContain('https://www.codexsinaiticus.org/');
    expect(data).toContain('https://www.deadseascrolls.org.il/');
    expect(data).toContain("status: 'curated_seed'");
  });


  it('limits the Mark 16 folio source to one directly linked manuscript witness', () => {
    const source = BIBLE_OS_SOURCES.find(item => item.id === 'sinaiticus-mark16-folio-228');
    const variant = BIBLE_OS_VARIANTS.find(item => item.id === 'mark-long-ending');
    expect(source?.url).toBe('https://www.codexsinaiticus.org/en/manuscript.aspx?book=35');
    expect(source?.scope).toContain('This is one witness, not all textual traditions.');
    expect(source?.scope).toContain('reproduction rights not cleared');
    expect(variant?.sourceIds).toContain('sinaiticus-mark16-folio-228');
    expect(variant?.evidenceState).toBe('DISPUTED');
  });

  it('makes Bible OS a fail-closed production route with authorized verification', () => {
    const contract = JSON.parse(read(productionContractPath)) as { public_routes?: string[] };
    const authorizedVerifier = read(authorizedVerifierPath);

    expect(contract.public_routes).toContain('/knowledge/bible');
    expect(authorizedVerifier).toContain("'/knowledge/bible'");
    expect(authorizedVerifier).toContain("canonicalModuleRoutes['/knowledge/bible']");
    expect(authorizedVerifier).toContain('bible_os_route_reachable');
  });
});
