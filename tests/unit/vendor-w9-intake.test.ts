import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseW9Text } from '../../apps/web/src/lib/w9Intake';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS vendor W-9 intake', () => {
  it('extracts normalized W-9 facts while retaining only the last four TIN digits', () => {
    const parsed = parseW9Text([
      'Name (as shown on your income tax return)',
      'Future Atlas LLC',
      'Business name/disregarded entity name, if different from above',
      'Atlas Services',
      '☒ Partnership',
      'Address (number, street, and apt. or suite no.)',
      '123 Main Street',
      'City, state, and ZIP code',
      'Orlando, FL 32801',
      'Employer identification number',
      '12-3456789'
    ].join('\n'));

    expect(parsed.legalName).toBe('Future Atlas LLC');
    expect(parsed.businessName).toBe('Atlas Services');
    expect(parsed.classification).toBe('partnership');
    expect(parsed.addressLine1).toBe('123 Main Street');
    expect(parsed.city).toBe('Orlando');
    expect(parsed.state).toBe('FL');
    expect(parsed.postalCode).toBe('32801');
    expect(parsed.taxIdType).toBe('ein');
    expect(parsed.taxIdLast4).toBe('6789');
    expect(JSON.stringify(parsed)).not.toContain('12-3456789');
  });

  it('fails closed when the printed classification is present but no selected mark is proven', () => {
    const parsed = parseW9Text('Individual/sole proprietor C corporation S corporation Partnership Trust/estate');
    expect(parsed.classification).toBe('');
  });

  it('keeps 1099 reportability separate from W-9 onboarding and uses governed server persistence', () => {
    const migration = source('supabase/migrations/20260920214500_vendor_w9_intake.sql');
    const api = source('apps/web/src/lib/procureToPayApi.ts');
    const page = source('apps/web/src/modules/inventory/ProcureToPayPage.tsx');

    expect(migration).toContain("reportability_status text not null default 'review_required'");
    expect(migration).toContain('upsert_vendor_w9_profile_v1');
    expect(migration).toContain('purchasing_vendor_addresses');
    expect(migration).toContain('purchasing_vendor_tax_audit_events');
    expect(api).toContain('resolution=merge-duplicates,return=representation');
    expect(api).toContain('saveVendorW9Profile');
    expect(page).toContain('capture="environment"');
    expect(page).toContain('Review & save W-9 vendor');
    expect(page).toContain('1099 handling stays fail-closed');
  });
});
