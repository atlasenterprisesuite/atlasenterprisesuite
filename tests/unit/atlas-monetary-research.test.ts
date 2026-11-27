import { describe, expect, it } from 'vitest';
import { classifyInstrument, assessResearchLink } from '../../packages/pay/src/monetaryResearch';

describe('ATLAS monetary research (read only)', () => {
  it('distinguishes money, instruments and infrastructure', () => {
    expect(classifyInstrument('bitcoin').kind).toBe('crypto_asset');
    expect(classifyInstrument('cbdc-retail').kind).toBe('central_bank_money');
    expect(classifyInstrument('fednow').kind).toBe('payment_rail');
    expect(classifyInstrument('ubs-usoi-etn').kind).toBe('debt_security');
    expect(classifyInstrument('stablecoin').kind).toBe('private_token');
    expect(classifyInstrument('uranium').kind).toBe('physical_commodity');
    expect(classifyInstrument('atlas-credits').kind).toBe('internal_credit_concept');
  });
  it('never guesses from ambiguous tickers or unknown names', () => {
    expect(classifyInstrument('USOI').kind).toBe('unknown');
    expect(classifyInstrument('unlisted').kind).toBe('unknown');
    expect(classifyInstrument('__proto__').kind).toBe('unknown');
  });
  const now = Date.parse('2026-11-27T12:00:00Z');
  const input = { from: 'uranium', to: 'bitcoin', relation: 'causal' as const, now };
  it('blocks unsupported causal assertions', () => {
    expect(assessResearchLink(input).gate).toBe('blocked');
    expect(assessResearchLink(input).status).toBe('hypothesis');
  });
  const source = { source: 'example research fixture', reference: 'fixture-1', observedAt: '2026-11-26T12:00:00Z', authenticated: true, authoritative: true };
  it('does not turn source metadata into causal proof', () => {
    expect(assessResearchLink({ ...input, evidence: source }).status).toBe('hypothesis');
    expect(assessResearchLink({ ...input, evidence: source }).gate).toBe('blocked');
  });
  it('permits only candidate review for documented noncausal links', () => {
    const result = assessResearchLink({ ...input, relation: 'dependency', evidence: source });
    expect(result.status).toBe('review_candidate');
    expect(result.gate).toBe('review_only');
    expect(result.productionReady).toBe(false);
  });
  it('blocks missing, stale, future or unauthenticated sources', () => {
    for (const evidence of [undefined, {...source, authenticated: false}, {...source, reference: ''}, {...source, observedAt: '2025-01-01T00:00:00Z'}, {...source, observedAt: '2027-01-01T00:00:00Z'}]) {
      expect(assessResearchLink({ ...input, relation: 'dependency', evidence }).gate).toBe('blocked');
    }
  });
  it('blocks unknown endpoints and invalid evaluation time', () => {
    expect(assessResearchLink({...input, from: 'USOI', relation: 'dependency', evidence: source}).gate).toBe('blocked');
    expect(() => assessResearchLink({...input, now: NaN})).toThrow();
  });
});
