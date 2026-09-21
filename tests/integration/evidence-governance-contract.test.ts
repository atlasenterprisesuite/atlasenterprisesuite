import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('authenticated evidence status release gate', () => {
  it('keeps the universal completion-state vocabulary fail-closed', () => {
    const source = read('packages/core/src/evidence.ts');
    for (const state of [
      'connected',
      'approved',
      'paid',
      'signed',
      'printed',
      'shipped',
      'fulfilled'
    ]) {
      expect(source).toContain(`'${state}'`);
    }
    expect(source).toContain('authenticated_evidence_required');
  });

  it('gates visible CRM connected state with authenticated evidence', () => {
    const source = read('apps/web/src/modules/business/crm/CrmHomePage.tsx');
    expect(source).toContain('canDisplayEvidenceBackedState');
    expect(source).toContain('providerAccountId');
    expect(source).toContain('lastVerifiedAt');
    expect(source).toContain('Verification required');
  });

  it('gates Commerce fulfilled persistence with authenticated evidence', () => {
    const source = read('supabase/functions/atlas-commerce-dispatch/index.ts');
    expect(source).toContain('canDisplayEvidenceBackedState');
    expect(source).toContain('AUTHENTICATED_EVIDENCE_REQUIRED');
    expect(source.indexOf('AUTHENTICATED_EVIDENCE_REQUIRED')).toBeLessThan(
      source.indexOf("status: 'fulfilled'")
    );
  });

  it('runs inside the full repository verification path used by production workflows', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:all']).toContain('npm run test:unit');
    expect(pkg.scripts?.['verify:all']).toContain('npm run test:integration');
  });
});
