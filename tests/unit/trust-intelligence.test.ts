import { describe, expect, it } from 'vitest';
import { assessTrustClaim, type TrustEvidence } from '../../packages/core/src/trust-intelligence';

const regulator: TrustEvidence = {
  id: 'regulator-1', subjectKey: 'cider-casino', jurisdiction: 'FL',
  claim: 'authorized', sourceType: 'regulator', verification: 'authenticated',
  retrievedAt: '2026-10-17T12:00:00Z', expiresAt: '2026-11-17T12:00:00Z',
  digest: 'sha256:verified-regulator-document'
};
const now = '2026-10-18T12:00:00Z';
describe('TRUST-0001 fail-closed claim evaluator', () => {
  it('does not transform Florida sweepstakes eligibility into regulatory permission', () => {
    expect(assessTrustClaim('cider-casino', 'FL', [{...regulator,sourceType:'operator',verification:'self-reported'}], now).status).toBe('unverified');
  });
  it('denies a positive claim without authenticated regulator evidence', () => {
    expect(assessTrustClaim('cider-casino', 'FL', [], now).status).toBe('unverified');
  });
  it('rejects a forged self-declared regulator record', () => {
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,verification:'self-reported'}],now).status).toBe('unverified');
  });
  it('requires matching subject and jurisdiction', () => {
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,subjectKey:'other'}],now).status).toBe('unverified');
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,jurisdiction:'NV'}],now).status).toBe('unverified');
  });
  it('rejects expired and future-dated sources', () => {
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,expiresAt:'2026-10-17T00:00:00Z'}],now).status).toBe('unverified');
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,retrievedAt:'2026-10-19T00:00:00Z'}],now).status).toBe('unverified');
  });
  it('rejects missing digest and malformed timestamps', () => {
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,digest:''}],now).status).toBe('unverified');
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,expiresAt:'invalid'}],now).status).toBe('unverified');
  });
  it('escalates contradictory authenticated regulator records to review', () => {
    expect(assessTrustClaim('cider-casino','FL',[regulator,{...regulator,id:'regulator-2',claim:'prohibited'}],now).status).toBe('needs-review');
  });
  it('does not confuse positive operator reviews with regulatory proof', () => {
    expect(assessTrustClaim('cider-casino','FL',[{...regulator,sourceType:'user-review',verification:'self-reported'}],now).status).toBe('unverified');
  });
  it('only reports supported when authenticated, scoped, current regulator evidence exists', () => {
    expect(assessTrustClaim('cider-casino','FL',[regulator],now)).toEqual({status:'supported', evidenceIds:['regulator-1']});
  });
});
