import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ATLAS Social to CRM handoff contract', () => {
  it('registers the handoff route and calls the governed crm.create operation', () => {
    const routes = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/business/crm/CrmRoutes.tsx'), 'utf8');
    const pagePath = resolve(process.cwd(), 'apps/web/src/modules/business/crm/CrmSocialHandoffPage.tsx');
    expect(routes).toContain('/crm/social-handoff');
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).toContain("'crm.create'");
    expect(page).toContain('sourceThreadId');
    expect(page).toContain('/crm/integrations/hubspot');
  });

  it('enforces a dedicated CRM write permission at the edge boundary', () => {
    const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/atlas-crm-hubspot/index.ts'), 'utf8');
    expect(edge).toContain("'crm.create'");
    expect(edge).toContain("'crm.write'");
  });
});
