import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagePath = 'apps/web/src/modules/business/BusinessEcosystemPage.tsx';
const resolverPath = 'apps/web/src/extensions/resolveAtlasExtension.tsx';
const registryPath = 'apps/web/src/modules/registry.ts';

const page = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const resolver = existsSync(resolverPath) ? readFileSync(resolverPath, 'utf8') : '';
const registry = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : '';

describe('ATLAS Business ecosystem visual command center', () => {
  it('renders the approved module map as real navigation instead of a passive image', () => {
    expect(page).toContain('Ecosistema de Módulos');
    for (const label of ['Assistant','Work Command Center','Knowledge','Business','Finance / Accounting','Payroll / HR','Inventory / Purchasing','CRM / Sales','Advisory','Business Analytics','Creator Studio / Social','Cloud']) {
      expect(page).toContain(label);
    }
    expect(page).toContain('Herramientas útiles:');
    expect(page).toContain('Cómo leer ATLAS');
    expect(page).toContain('Ruta ideal de uso');
  });

  it('integrates analytics into Business while preserving the canonical analytics implementation', () => {
    expect(page).toContain("to: '/business/insights'");
    expect(resolver).toContain("pathname === '/business/insights'");
    expect(resolver).toContain('<RequireAtlasIdentity><AnalyticsRoutes /></RequireAtlasIdentity>');
    const start = registry.indexOf("id: 'analytics'");
    const end = registry.indexOf('\n  {', start + 1);
    const block = registry.slice(start, end === -1 ? registry.length : end);
    expect(block).toContain('showInNavigation: false');
  });

  it('keeps every visible tool bound to an implemented ATLAS route', () => {
    for (const route of ['/assistant','/work','/knowledge','/revenue','/finance','/people','/inventory/procure-to-pay','/crm','/advisory','/business/insights','/studio','/cloud']) {
      expect(page).toContain(route);
    }
    expect(page).not.toContain('href="#"');
    expect(page).not.toContain('Coming Soon');
  });
});
