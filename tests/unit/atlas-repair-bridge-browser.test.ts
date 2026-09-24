import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS repair bridge browser and tenant boundary', () => {
  const source = readFileSync('supabase/functions/atlas-repair-bridge/index.ts', 'utf8');

  it('allows only ATLAS browser origins and supports the organization header', () => {
    expect(source).toContain("'https://atlasenterprisesuite.com'");
    expect(source).toContain("'https://www.atlasenterprisesuite.com'");
    expect(source).toContain("'access-control-allow-headers':'authorization, apikey, content-type, x-atlas-org-id'");
    expect(source).toContain("if(req.method==='OPTIONS')return optionsResponse(origin)");
    expect(source).not.toContain("'access-control-allow-origin':'*'");
  });

  it('resolves the explicitly selected organization instead of silently taking the first membership', () => {
    expect(source).toContain("const requestedOrg=clean(req.headers.get('x-atlas-org-id'),80)");
    expect(source).toContain("membershipQuery=membershipQuery.eq('org_id',requestedOrg)");
    expect(source).toContain("if(!requestedOrg&&members.length>1)throw new Error('active_organization_required')");
  });
});
