// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyInstrument, assessResearchLink, assessDocumentedResearchLink } from '../../packages/pay/src';

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
  it('blocks metadata-only noncausal links', () => {
    const result = assessResearchLink({ ...input, relation: 'dependency', evidence: source });
    expect(result.status).toBe('hypothesis');
    expect(result.gate).toBe('blocked');
    expect(result.blockers).toContain('document-integrity');
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
  const noncausal = { ...input, relation: 'dependency' as const, evidence: source };
  // Synthetic fixture: known SHA-256 of the UTF-8 text "abc"; no real source assertion.
  const document = { reference: source.reference, from: noncausal.from, to: noncausal.to,
    relation: noncausal.relation, text: 'abc',
    expectedSha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
  it('allows integrity-checked documents only into manual review', async () => {
    const result = await assessDocumentedResearchLink(noncausal, document);
    expect(result.status).toBe('review_candidate');
    expect(result.gate).toBe('review_only');
    expect(result.productionReady).toBe(false);
  });
  it('rejects changed, empty, oversized or malformed documents', async () => {
    for (const item of [{...document, text:'abd'}, {...document, text:''},
      {...document, text:'a'.repeat(1_048_577)}, {...document, expectedSha256:'invalid'}]) {
      const result = await assessDocumentedResearchLink(noncausal, item);
      expect(result.gate).toBe('blocked');
      expect(result.blockers).toContain('document-integrity');
    }
  });
  it('rejects mismatched references and claim bindings', async () => {
    for (const item of [{...document, reference:'other'}, {...document, from:'oil'},
      {...document, to:'ethereum'}, {...document, relation:'association' as const}]) {
      expect((await assessDocumentedResearchLink(noncausal, item)).gate).toBe('blocked');
    }
  });
  it('keeps causal claims and stale metadata blocked even with matching bytes', async () => {
    expect((await assessDocumentedResearchLink(input, {...document, relation:'causal'})).gate).toBe('blocked');
    expect((await assessDocumentedResearchLink({...noncausal, evidence:{...source, observedAt:'2025-01-01T00:00:00Z'}}, document)).gate).toBe('blocked');
  });
  it('blocks malformed untrusted source fields instead of throwing', () => {
    const malformed = {...source, source: 123} as unknown as typeof source;
    expect(assessResearchLink({...noncausal, evidence:malformed}).gate).toBe('blocked');
  });
});
