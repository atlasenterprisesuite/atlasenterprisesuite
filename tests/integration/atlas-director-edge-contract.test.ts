import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
const context = readFileSync('supabase/functions/atlas-creator/_shared/context.ts', 'utf8');
const repository = readFileSync('supabase/functions/atlas-creator/_shared/repository.ts', 'utf8');
const errors = readFileSync('supabase/functions/atlas-creator/_shared/errors.ts', 'utf8');

describe('atlas-creator Edge contract', () => {
  it('requires bearer auth and active organization membership', () => {
    expect(context).toContain("req.headers.get('authorization')");
    expect(context).toContain("from('organization_members')");
    expect(context).toContain(".eq('status', 'active')");
  });

  it('keeps writes server-side and organization scoped', () => {
    expect(repository).toContain(".eq('organization_id', orgId)");
    expect(repository).toContain("from('audit_logs')");
    expect(repository).toContain("table_name: 'creator_director'");
  });

  it('supports production-origin CORS and browser preflight', () => {
    expect(index).toContain("req.method === 'OPTIONS'");
    expect(index).toContain('withCors(');
    expect(errors).toContain('https://atlasenterprisesuite.com');
    expect(errors).toContain('https://www.atlasenterprisesuite.com');
    expect(errors).toContain("'access-control-allow-origin'");
  });

  it('does not trust browser-owned lifecycle status or creator provenance on save', () => {
    expect(repository).toContain("status: 'draft'");
    expect(repository).toContain("createdByUserId: existing ? String(existing.created_by) : ctx.userId");
    expect(repository).not.toContain('production_spec_json: spec');
  });

  it('fails provider readiness closed when capability metadata is malformed', () => {
    expect(repository).toContain('isProviderCapabilityShape');
    expect(repository).toContain("connectionState = 'configured-unverified'");
  });

  it('contains no direct provider secrets', () => {
    expect(index).not.toMatch(/OPENART_API_KEY|provider_secret|private_key/i);
  });
});
