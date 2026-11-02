import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED, validate } from '../../scripts/security/atlas-web-777-validator.mjs';
const SHA='a'.repeat(40);
function fixture() {
  return { prs:Object.entries(REQUIRED).map(([number,names])=>({
    number:Number(number),expectedSha:SHA,actualSha:SHA,
    checks:names.map(name=>({name,sha:SHA,status:'completed',conclusion:'success'}))
  })),foundationBootstrapCertified:true,rulesetEnforcementCertified:true,revocationCertified:true };
}
test('complete verified fixture passes only with explicit attestations',()=>assert.equal(validate(fixture()).ok,true));
test('stale HEAD fails closed',()=>{const f=fixture();f.prs[0].actualSha='b'.repeat(40);assert.equal(validate(f).ok,false)});
for (const state of ['failure','pending','cancelled','absent']) {
  test(`required check ${state} fails closed`,()=>{
    const f=fixture();const checks=f.prs[0].checks;
    if(state==='absent') checks.length=0;
    else if(state==='pending') {checks[0].status='in_progress';checks[0].conclusion=null}
    else {checks[0].conclusion=state}
    assert.equal(validate(f).ok,false);
  });
}
test('wrong SHA check cannot certify',()=>{const f=fixture();f.prs[0].checks[0].sha='b'.repeat(40);assert.equal(validate(f).ok,false)});
test('missing PR cannot certify',()=>{const f=fixture();f.prs.pop();assert.equal(validate(f).ok,false)});
test('unproven ruleset cannot certify',()=>{const f=fixture();f.rulesetEnforcementCertified=false;assert.ok(validate(f).blockers.includes('P0_RULESET_ENFORCEMENT_UNPROVEN'))});
test('unproven foundation cannot certify',()=>{const f=fixture();f.foundationBootstrapCertified=false;assert.equal(validate(f).ok,false)});
test('unproven revocation cannot certify',()=>{const f=fixture();f.revocationCertified=false;assert.equal(validate(f).ok,false)});
