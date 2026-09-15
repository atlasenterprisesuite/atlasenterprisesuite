import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasShell } from '../../apps/web/src/components/AtlasShell';
import { CrmRoutes } from '../../apps/web/src/modules/business/crm/CrmRoutes';

const resolverSource = readFileSync(
  'apps/web/src/extensions/resolveAtlasExtension.tsx',
  'utf8'
);

afterEach(() => cleanup());

describe('ATLAS CRM routing', () => {
  it('adds CRM to the canonical ATLAS shell navigation', () => {
    render(
      <MemoryRouter initialEntries={['/crm']}>
        <AtlasShell><div>CRM route body</div></AtlasShell>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'CRM' })).toHaveAttribute('href', '/crm');
  });

  it.each([
    ['/crm', 'ATLAS CRM'],
    ['/crm/contacts', 'Contacts'],
    ['/crm/contacts/101', 'Contact'],
    ['/crm/companies', 'Accounts'],
    ['/crm/companies/201', 'Account'],
    ['/crm/deals', 'Opportunities'],
    ['/crm/deals/301', 'Opportunity'],
    ['/crm/service', 'Service Cases'],
    ['/crm/service/401', 'Service Case'],
    ['/crm/activities', 'Activities'],
    ['/crm/integrations', 'Integrations'],
    ['/crm/integrations/hubspot', 'HubSpot Integration']
  ])('resolves %s to %s', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <CrmRoutes />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('mounts the CRM route family behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/crm'");
    expect(resolverSource).toContain("pathname.startsWith('/crm/')");
    expect(resolverSource).toContain('<RequireAtlasIdentity>');
    expect(resolverSource).toContain('<CrmRoutes />');
  });
});
