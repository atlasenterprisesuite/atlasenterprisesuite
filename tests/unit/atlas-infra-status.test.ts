import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS infrastructure status aggregation contract', () => {
  const source = () => readFileSync('adapters/supabase/atlas-infra-status/index.ts', 'utf-8');

  it('uses the current canonical repository and governed verification registry', () => {
    const code = source();

    expect(code).toContain("'atlasenterprisesuite/atlasenterprisesuite'");
    expect(code).toContain("from('atlas_runtime_verification_runs')");
    expect(code).toContain(".eq('verification_type', 'infrastructure-deployment')");
  });

  it('reports infrastructure evidence separately from runtime provider verification', () => {
    const code = source();

    expect(code).toContain('latest_infrastructure_verification');
    expect(code).toContain('latest_runtime_verification');
    expect(code).toContain('infrastructure_evidence');
  });
});
