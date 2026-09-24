import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ATLAS Social to CRM handoff contract', () => {
  it('keeps the handoff route as a read-only review surface', () => {
    const routes = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/business/crm/CrmRoutes.tsx'), 'utf8');
    const pagePath = resolve(process.cwd(), 'apps/web/src/modules/business/crm/CrmSocialHandoffPage.tsx');
    expect(routes).toContain('/crm/social-handoff');
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).toContain('HubSpot P0 is read-only');
    expect(page).not.toContain("'crm.create'");
    expect(page).toContain('/crm/integrations/hubspot');
  });

  it('does not expose HubSpot CRM writes at the edge boundary', () => {
    const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/atlas-crm-hubspot/index.ts'), 'utf8');
    expect(edge).not.toContain("'crm.create'");
    expect(edge).not.toContain('HUBSPOT_CRM_WRITES_ENABLED');
  });
});
