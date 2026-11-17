import { describe, expect, it } from 'vitest';
import * as accounting from '../../packages/accounting/src';

const csv = (rows: string) => `id,date,amount,currency,reference,description\n${rows}`;
const bankCsv = csv('B1,2026-11-01,-12.30,USD,INV-1,Payment\nB2,2026-11-03,100.00,USD,SALE-1,Receipt');
const ledgerCsv = csv('L1,2026-11-02,-12.30,USD,inv-1,Payment\nL2,2026-11-03,99.00,USD,SALE-1,Receipt');

describe('statement comparison accounting', () => {
  // Catches absence or bypass of the domain contract before any product code exists.
  it('exposes a statement parser and comparison engine', () => {
    expect(accounting).toHaveProperty('parseReconciliationCsv');
    expect(accounting).toHaveProperty('reconcileStatements');
    expect(accounting).toHaveProperty('buildReconciliationEvidence');
  });

  it('reads original CSV syntax and converts amounts to exact minor units', () => {
    const rows = accounting.parseReconciliationCsv('\ufeffid,date,amount,currency,reference,description\r\nB1,2024-02-29,-0.29,USD,R1,"A, B ""quoted""\r\nnext"\r\n');
    expect(rows).toEqual([{ id: 'B1', date: '2024-02-29', amountMinor: -29, currency: 'USD', reference: 'R1', description: 'A, B "quoted"\r\nnext' }]);
  });

  it.each([
    ['impossible date', csv('B1,2026-02-29,1.00,USD,R1,x')],
    ['precision', csv('B1,2026-01-01,0.001,USD,R1,x')],
    ['exponent', csv('B1,2026-01-01,1e3,USD,R1,x')],
    ['unsafe amount', csv('B1,2026-01-01,90071992547409.92,USD,R1,x')],
    ['unsupported minor digits', csv('B1,2026-01-01,1.00,JPY,R1,x')],
    ['duplicate id', csv('B1,2026-01-01,1,USD,R1,x\n B1 ,2026-01-01,2,USD,R2,x')],
    ['extra column', csv('B1,2026-01-01,1,USD,R1,x,unexpected')],
    ['unclosed quote', csv('B1,2026-01-01,1,USD,R1,"x')],
    ['stray quote', csv('B1,2026-01-01,1,USD,R1,x"')],
    ['trailing quote garbage', csv('B1,2026-01-01,1,USD,R1,"x"garbage')],
    ['duplicate header', 'id,date,amount,currency,id\nB1,2026-01-01,1,USD,R1'],
    ['missing header', 'id,date,amount\nB1,2026-01-01,1'],
    ['unknown header', 'id,date,amount,currency,account\nB1,2026-01-01,1,USD,R1'],
    ['empty data', 'id,date,amount,currency\n'],
    ['mixed currencies', csv('B1,2026-01-01,1,USD,R1,x\nB2,2026-01-01,1,EUR,R2,x')]
  ])('rejects %s without a partial result', (_name, input) => {
    expect(() => accounting.parseReconciliationCsv(input)).toThrow();
  });

  it.each(['""', '"  "'])('does not silently drop an explicit empty CSV record %s', record => {
    expect(() => accounting.parseReconciliationCsv(`id,date,amount,currency\nB1,2026-01-01,1,USD\n${record}\n`)).toThrow();
  });

  it('proposes only a mutually unique reference, sign, amount and date match', () => {
    const result = accounting.reconcileStatements(accounting.parseReconciliationCsv(bankCsv), accounting.parseReconciliationCsv(ledgerCsv), { dateWindowDays: 3 });
    expect(result.proposals).toEqual([{ bankId: 'B1', ledgerId: 'L1', amountMinor: -1230, currency: 'USD', dateDeltaDays: 1 }]);
    expect(result.bankExceptions).toEqual([{ id: 'B2', reason: 'no_candidate' }]);
    expect(result.ledgerExceptions).toEqual([{ id: 'L2', reason: 'no_candidate' }]);
    expect(result.totals).toEqual({ currency: 'USD', bankMinor: 8770, ledgerMinor: 8670, differenceMinor: 100 });
  });

  it.each([
    ['one bank to two ledger rows', 'B1,2026-11-01,10,USD,R1,x', 'L1,2026-11-01,10,USD,R1,x\nL2,2026-11-01,10,USD,R1,x', ['B1'], ['L1', 'L2']],
    ['two bank to one ledger row', 'B1,2026-11-01,10,USD,R1,x\nB2,2026-11-01,10,USD,R1,x', 'L1,2026-11-01,10,USD,R1,x', ['B1', 'B2'], ['L1']]
  ])('retains ambiguity for %s', (_name, bank, ledger, bankIds, ledgerIds) => {
    const result = accounting.reconcileStatements(accounting.parseReconciliationCsv(csv(bank)), accounting.parseReconciliationCsv(csv(ledger)), { dateWindowDays: 0 });
    expect(result.proposals).toEqual([]);
    expect(result.bankExceptions).toEqual(bankIds.map(id => ({ id, reason: 'ambiguous' })));
    expect(result.ledgerExceptions).toEqual(ledgerIds.map(id => ({ id, reason: 'ambiguous' })));
  });

  it('never treats missing references, opposite signs or out-of-window dates as approval', () => {
    const bank = accounting.parseReconciliationCsv(csv('B1,2026-11-01,10,USD,,x\nB2,2026-11-01,-10,USD,R2,x\nB3,2026-11-01,10,USD,R3,x'));
    const ledger = accounting.parseReconciliationCsv(csv('L1,2026-11-01,10,USD,,x\nL2,2026-11-01,10,USD,R2,x\nL3,2026-11-05,10,USD,R3,x'));
    const result = accounting.reconcileStatements(bank, ledger, { dateWindowDays: 3 });
    expect(result.proposals).toEqual([]);
    expect(result.bankExceptions).toEqual([{ id: 'B1', reason: 'missing_reference' }, { id: 'B2', reason: 'no_candidate' }, { id: 'B3', reason: 'no_candidate' }]);
  });

  it('rejects currency mismatches, invalid windows and unsafe aggregate arithmetic', () => {
    const bank = accounting.parseReconciliationCsv(csv('B1,2026-01-01,1,USD,R1,x'));
    const foreign = accounting.parseReconciliationCsv(csv('L1,2026-01-01,1,EUR,R1,x'));
    expect(() => accounting.reconcileStatements(bank, foreign, { dateWindowDays: 3 })).toThrow();
    for (const dateWindowDays of [-1, 31, 1.5, NaN]) expect(() => accounting.reconcileStatements(bank, bank, { dateWindowDays })).toThrow();
    const huge = accounting.parseReconciliationCsv(csv('B1,2026-01-01,90071992547409.91,USD,R1,x\nB2,2026-01-01,0.01,USD,R2,x'));
    expect(() => accounting.reconcileStatements(huge, bank, { dateWindowDays: 0 })).toThrow();
  });

  it('rejects more than 10000 rows and revalidates programmatic entries', () => {
    const input = Array.from({ length: 10001 }, (_, i) => `B${i},2026-01-01,1,USD,R${i},x`).join('\n');
    expect(() => accounting.parseReconciliationCsv(csv(input))).toThrow();
    const valid = accounting.parseReconciliationCsv(bankCsv);
    expect(() => accounting.reconcileStatements([{ ...valid[0], amountMinor: 0.1 }], valid, { dateWindowDays: 0 })).toThrow();
  });

  it('accepts the 10000-row boundary while keeping repeated candidates ambiguous', () => {
    const rows = accounting.parseReconciliationCsv(csv(Array.from({ length: 10000 }, (_, i) => `M${i},2026-01-01,1,USD,R1,x`).join('\n')));
    const result = accounting.reconcileStatements(rows, rows, { dateWindowDays: 30 });
    expect(result.proposals).toEqual([]);
    expect(result.bankExceptions).toHaveLength(10000);
    expect(result.ledgerExceptions).toHaveLength(10000);
    expect(result.totals.bankMinor).toBe(1000000);
  });

  it('includes the calendar-day boundary across a year change', () => {
    const bank = accounting.parseReconciliationCsv(csv('B1,2026-12-31,-0.01,USD, REF ,x'));
    const ledger = accounting.parseReconciliationCsv(csv('L1,2027-01-03,-0.01,USD,ref,x'));
    expect(accounting.reconcileStatements(bank, ledger, { dateWindowDays: 3 }).proposals).toEqual([{ bankId: 'B1', ledgerId: 'L1', amountMinor: -1, currency: 'USD', dateDeltaDays: 3 }]);
    expect(accounting.reconcileStatements(bank, ledger, { dateWindowDays: 2 }).proposals).toEqual([]);
  });

  it('exports normalized sources and method without implying bank verification or posting', () => {
    const evidence = accounting.buildReconciliationEvidence({ bank: { fileName: 'bank.csv', sha256: 'a'.repeat(64), entries: accounting.parseReconciliationCsv(bankCsv) }, ledger: { fileName: 'ledger.csv', sha256: 'b'.repeat(64), entries: accounting.parseReconciliationCsv(ledgerCsv) } }, { dateWindowDays: 3 }, '2026-11-16T15:00:00.000Z');
    expect(evidence.mode).toBe('local_file_comparison');
    expect(evidence.reviewState).toBe('requires_human_review');
    expect(evidence.bankConnected).toBe(false);
    expect(evidence.posted).toBe(false);
    expect(evidence.sources.bank.sha256).toBe('a'.repeat(64));
    expect(evidence.sources.bank.entries).toHaveLength(2);
    expect(evidence.method.dateWindowDays).toBe(3);
    expect(evidence.result.totals.differenceMinor).toBe(100);
  });
});
