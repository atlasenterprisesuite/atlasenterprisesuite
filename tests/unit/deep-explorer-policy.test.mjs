import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResearchSource } from '../../packages/deep-explorer/source-policy.mjs';
const allowedContext={researchPermission:true,tenantAuthorized:true};
const source={kind:'academic',url:'https://pubmed.ncbi.nlm.nih.gov/',readOnly:true,provenance:'primary'};
const onionHost='a'.repeat(56)+'.onion';
test('admits authorized HTTPS primary research in read-only mode',()=>{
 assert.equal(evaluateResearchSource(source,allowedContext).allowed,true);
});
test('denies missing tenant authorization and missing researcher permission',()=>{
 assert.equal(evaluateResearchSource(source,{researchPermission:true}).reason,'tenant_authorization_required');
 assert.equal(evaluateResearchSource(source,{tenantAuthorized:true}).reason,'permission_required');
});
test('blocks local, internal, IP and untrusted protocols',()=>{
 for(const url of ['http://example.org','https://localhost/','https://127.0.0.1/','https://10.0.0.5/','https://service.internal/','file:///etc/passwd']) {
  assert.equal(evaluateResearchSource({...source,url},allowedContext).allowed,false,url);
 }
});
test('blocks mutations, unverified provenance and embedded credentials',()=>{
 for(const change of [{readOnly:false},{provenance:'unknown'},{url:'https://user:pass@example.org/'}]) {
  assert.equal(evaluateResearchSource({...source,...change},allowedContext).allowed,false);
 }
});
test('Tor research requires explicit isolated transport and verified v3 address',()=>{
 const s={...source,kind:'onion',url:'https://'+onionHost+'/'};
 assert.equal(evaluateResearchSource(s,allowedContext).reason,'onion_research_disabled');
 assert.equal(evaluateResearchSource(s,{...allowedContext,onionResearchEnabled:true}).reason,'isolated_tor_required');
 assert.equal(evaluateResearchSource(s,{...allowedContext,onionResearchEnabled:true,isolatedTorTransport:true}).reason,'onion_provenance_unverified');
 assert.equal(evaluateResearchSource(s,{...allowedContext,onionResearchEnabled:true,isolatedTorTransport:true,verifiedOnionAddress:true}).transport,'isolated-tor');
});
test('rejects malformed onion addresses',()=>{
 assert.equal(evaluateResearchSource({...source,kind:'onion',url:'https://fake.onion/'},{...allowedContext,onionResearchEnabled:true,isolatedTorTransport:true,verifiedOnionAddress:true}).reason,'invalid_onion_v3');
});
