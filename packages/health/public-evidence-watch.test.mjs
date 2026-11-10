import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePublicSignal,evaluatePublicClaim,EVIDENCE_STATUS} from './public-evidence-watch.mjs';

const signal=(overrides={})=>({
 sourceId:'sample-1',claimKey:'respiratory-trend',region:'Florida',
 sourceFamily:'CDC',url:'https://data.cdc.gov/resource/example',
 publishedOn:'2026-10-15',observedOn:'2026-10-10',stance:'SUPPORTS',...overrides
});
test('requires independently named source families for corroboration',()=>{
 const one=evaluatePublicClaim([signal()],{asOf:'2026-10-17'});
 assert.equal(one.status,EVIDENCE_STATUS.INSUFFICIENT);
 const two=evaluatePublicClaim([signal(),signal({sourceId:'sample-2',sourceFamily:'WHO',url:'https://www.who.int/example'})],{asOf:'2026-10-17'});
 assert.equal(two.status,EVIDENCE_STATUS.CORROBORATED);
 assert.equal(two.outbreakConfirmed,false);
});
test('disputes are retained and classify as contradiction',()=>{
 const r=evaluatePublicClaim([signal(),signal({sourceId:'sample-2',sourceFamily:'WHO',url:'https://www.who.int/example',stance:'DISPUTES'})],{asOf:'2026-10-17'});
 assert.equal(r.status,EVIDENCE_STATUS.CONTRADICTED);
});
test('deduplicates exact repeats, rejects altered same-source identifiers',()=>{
 assert.equal(evaluatePublicClaim([signal(),signal()],{asOf:'2026-10-17'}).acceptedRecords,1);
 assert.throws(()=>evaluatePublicClaim([signal(),signal({stance:'DISPUTES'})],{asOf:'2026-10-17'}),/conflicting_source_identity/);
});
test('rejects unsafe or malformed URLs, fabricated data and dates',()=>{
 for(const url of ['http://data.cdc.gov/test','https://data.cdc.gov.evil.test/','https://127.0.0.1/','https://user@cdc.gov/'])
  assert.throws(()=>normalizePublicSignal(signal({url})),/invalid_signal/);
 assert.throws(()=>normalizePublicSignal(signal({observedOn:'2026-10-16'})),/invalid_signal_dates/);
 assert.throws(()=>normalizePublicSignal(signal({publishedOn:'2026-02-30'})),/invalid_signal/);
});
test('stale, future, mixed claims and invalid windows fail safely',()=>{
 assert.equal(evaluatePublicClaim([signal()],{asOf:'2026-12-17'}).acceptedRecords,0);
 assert.equal(evaluatePublicClaim([signal()],{asOf:'2026-10-01'}).acceptedRecords,0);
 assert.throws(()=>evaluatePublicClaim([signal(),signal({sourceId:'two',claimKey:'unrelated'})],{asOf:'2026-10-17'}),/mixed_claim_scope/);
 assert.throws(()=>evaluatePublicClaim([signal()],{asOf:'invalid'}),/invalid_evaluation_window/);
});
