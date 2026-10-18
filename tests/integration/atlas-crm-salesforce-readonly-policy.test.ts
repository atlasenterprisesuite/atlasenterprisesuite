import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync(
  'supabase/functions/atlas-crm-salesforce/index.ts',
  'utf8'
);
const adapter = readFileSync(
  'supabase/functions/_shared/salesforce-crm.ts',
  'utf8'
);
const operations = readFileSync(
  'supabase/functions/_shared/salesforce-crm-operations.ts',
  'utf8'
);
const config = readFileSync('supabase/config.toml', 'utf8');

describe('ATLAS CRM Salesforce read-only and callback policy', () => {
  it('does not expose Salesforce business-record write operations', () => {
    for (const operation of ['crm.create', 'crm.update', 'crm.delete', 'crm.upsert']) {
      expect(edge).not.toContain(`'${operation}'`);
      expect(operations).not.toContain(`'${operation}'`);
    }
    expect(adapter).not.toMatch(/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  });

  it('uses the canonical ATLAS OAuth callback boundary with internal auth controls', () => {
    expect(config).toContain('[functions.atlas-crm-salesforce]');
    expect(config).toMatch(/\[functions\.atlas-crm-salesforce\][\s\S]*verify_jwt\s*=\s*false/);
    expect(edge).toContain("body.operation === 'oauth.callback'");
    expect(edge).toContain('authenticatedUser');
    expect(edge).toContain('hasAnyPermission');
  });

  it('fails closed on duplicate org selection until inventory exists', () => {
    const lifecycle = readFileSync(
      'supabase/functions/_shared/salesforce-connection-lifecycle.ts',
      'utf8'
    );
    expect(lifecycle).toContain("'canonical_org_required'");
    expect(lifecycle).toContain("'org_inventory_required'");
    expect(lifecycle).toContain("operation: 'org.select_canonical'");
  });
});
