
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax productive UI contracts', () => {
  const control = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxControlCenter.tsx', 'utf8');
  const workspace = readFileSync(process.cwd() + '/apps/web/src/modules/tax/ProfessionalReturnWorkspace.tsx', 'utf8');
  const api = readFileSync(process.cwd() + '/apps/web/src/lib/taxApi.ts', 'utf8');

  it('uses a persistent tax control center instead of fabricated metrics', () => {
    expect(control).toContain('listTaxReturns');
    expect(control).toContain('createTaxReturn');
    expect(control).toContain('Live return work queue');
    expect(control).not.toContain('Math.random');
  });

  it('requires a persisted return id in the professional workspace', () => {
    expect(workspace).toContain("params.get('returnId')");
    expect(workspace).toContain('getTaxReturnWorkspace');
    expect(workspace).toContain('no longer creates a local/demo return');
    expect(workspace).not.toContain("returnId: 'draft-return'");
  });

  it('surfaces source-to-line provenance', () => {
    expect(workspace).toContain('Explain this number');
    expect(workspace).toContain('Source → fact → form line');
    expect(workspace).toContain('tax_fact_key');
    expect(api).toContain('tax_line_mappings');
  });

  it('exposes all productive persistence RPC clients', () => {
    for (const rpc of [
      'tax_create_return',
      'tax_set_step_state',
      'tax_register_source_document',
      'tax_record_fact',
      'tax_record_line_mapping',
      'tax_upsert_workpaper',
      'tax_open_diagnostic',
      'tax_resolve_diagnostic',
      'tax_create_carryforward',
      'tax_lock_return_snapshot'
    ]) expect(api).toContain(rpc);
  });
});
