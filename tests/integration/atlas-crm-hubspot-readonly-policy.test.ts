import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS CRM HubSpot P0 read-only policy', () => {
  it('does not expose a HubSpot CRM create operation at the edge boundary', () => {
    const edge = source('supabase/functions/atlas-crm-hubspot/index.ts');
    expect(edge).not.toContain("'crm.create'");
  });

  it('keeps the HubSpot operation layer read-only', () => {
    const operations = source('supabase/functions/_shared/hubspot-crm-operations.ts');
    expect(operations).not.toContain("'crm.create'");
    expect(operations).not.toContain('createObject');
    expect(operations).not.toContain('writesEnabled');
  });

  it('keeps the HubSpot provider adapter free of business-data write methods', () => {
    const adapter = source('supabase/functions/_shared/hubspot-crm.ts');
    expect(adapter).not.toContain('WRITE_FIELD_MAP');
    expect(adapter).not.toContain('CrmCreateRequest');
    expect(adapter).not.toContain('createObject(');
  });

  it('does not expose crm.create through the browser CRM client', () => {
    const client = source('apps/web/src/modules/business/crm/crmApi.ts');
    expect(client).not.toContain("'crm.create'");
  });

  it('does not allow the Social handoff page to write HubSpot business data', () => {
    const page = source('apps/web/src/modules/business/crm/CrmSocialHandoffPage.tsx');
    expect(page).not.toContain("'crm.create'");
    expect(page).not.toContain('Create contact in HubSpot');
    expect(page).not.toContain('Create opportunity in HubSpot');
    expect(page).not.toContain('Create service case in HubSpot');
  });
});
