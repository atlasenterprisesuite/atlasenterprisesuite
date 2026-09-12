import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
const context = readFileSync('supabase/functions/atlas-creator/_shared/context.ts', 'utf8');
const repository = readFileSync('supabase/functions/atlas-creator/_shared/repository.ts', 'utf8');

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

  it('contains no direct provider secrets', () => {
    expect(index).not.toMatch(/OPENART_API_KEY|provider_secret|private_key/i);
  });
});
