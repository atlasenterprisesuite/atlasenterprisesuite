import { describe, expect, it } from 'vitest';
import * as core from '../../packages/core/src/index';
import { normalizeGooglePermissions, googleOAuthScopesForPermissions } from '../../supabase/functions/_shared/google-oauth';

describe('Google selected-file import foundation', () => {
  it('requests only selected-file access through the existing OAuth helpers', () => {
    const permissions = normalizeGooglePermissions(['google.drive.selected']);
    expect(googleOAuthScopesForPermissions(permissions)).toEqual(['https://www.googleapis.com/auth/drive.file']);
    const url = core.buildGoogleAuthorizationUrl({ clientId: 'client', redirectUri: 'https://atlas.example/callback', state: 'signed', permissions });
    expect(new URL(url).searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
  });

  it('previews amounts without floating-point rounding and flags duplicate references', () => {
    expect(core.previewGoogleSheetTransactions).toBeTypeOf('function');
    const preview = core.previewGoogleSheetTransactions([
      ['reference', 'date', 'description', 'amount', 'currency'],
      ['A1', '2026-11-11', 'Invoice', '19.99', 'USD'],
      ['A1', '2026-11-11', 'Invoice', '19.99', 'USD'],
      ['A2', '2026-11-12', 'Refund', '-0.01', 'USD']
    ]);
    expect(preview.rows).toEqual([
      { rowNumber: 2, reference: 'A1', date: '2026-11-11', description: 'Invoice', amountMinor: 1999, currency: 'USD' },
      { rowNumber: 4, reference: 'A2', date: '2026-11-12', description: 'Refund', amountMinor: -1, currency: 'USD' }
    ]);
    expect(preview.issues).toEqual([{ rowNumber: 3, code: 'duplicate_reference' }]);
  });

  it('rejects missing or repeated columns before previewing any transactions', () => {
    expect(core.previewGoogleSheetTransactions).toBeTypeOf('function');
    expect(() => core.previewGoogleSheetTransactions([['date', 'amount']])).toThrow(/columns/i);
    expect(() => core.previewGoogleSheetTransactions([['reference', 'date', 'description', 'amount', 'currency', 'amount']])).toThrow(/columns/i);
  });

  it('flags invalid dates, ambiguous amounts, unsafe precision and unsupported currencies', () => {
    expect(core.previewGoogleSheetTransactions).toBeTypeOf('function');
    const header = ['reference', 'date', 'description', 'amount', 'currency'];
    const result = core.previewGoogleSheetTransactions([header,
      ['A', '2026-02-30', '', '1.00', 'USD'],
      ['B', '2026-11-11', '', '1,234', 'USD'],
      ['C', '2026-11-11', '', '1.001', 'USD'],
      ['D', '2026-11-11', '', '9007199254740992', 'USD'],
      ['E', '2026-11-11', '', '1', 'JPY'],
      ['F', '2026-11-11', '', '=SUM(A1)', 'USD']
    ]);
    expect(result.rows).toEqual([]);
    expect(result.issues.map(issue => issue.code)).toEqual(['invalid_date', 'invalid_amount', 'invalid_amount', 'invalid_amount', 'unsupported_currency', 'invalid_amount']);
  });

  it('keeps source row numbers, skips blanks and does not reserve invalid references', () => {
    const result = core.previewGoogleSheetTransactions([
      ['currency', 'amount', 'description', 'date', 'reference'],
      [],
      ['USD', 'invalid', '', '2026-11-11', 'A'],
      ['USD', '1.20', '', '2026-11-11', 'A'],
      ['USD', 1.20, '', '2026-11-11', 'B'],
      ['USD', '1.20', '', '2026-11-11', '']
    ]);
    expect(result.rows).toEqual([{ rowNumber: 4, reference: 'A', date: '2026-11-11', description: '', amountMinor: 120, currency: 'USD' }]);
    expect(result.issues).toEqual([
      { rowNumber: 3, code: 'invalid_amount' },
      { rowNumber: 5, code: 'invalid_row' },
      { rowNumber: 6, code: 'missing_reference' }
    ]);
    expect(() => core.previewGoogleSheetTransactions(Array.from({ length: 10002 }, () => []))).toThrow(/10000/);
  });
});
