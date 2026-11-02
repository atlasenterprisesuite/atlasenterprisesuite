import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../scripts/security/atlas-web-777-validator.mjs';
const sha='a'.repeat(40);
function base(){return {prs:[
{number:974,expectedSha:sha,actualSha:sha,checks:[{name:'ATLAS 777 Isolated PostgreSQL 17 Runtime',sha,status:'completed',conclusion:'success'}]},
{number:968,expectedSha:sha,actualSha:sha,checks:['ATLAS Advisory 777 Revocation Evidence (isolated)','Advisory Office CI'].map(name=>({name,sha,status:'completed',conclusion:'success'}))},
{number:970,expectedSha:sha,actualSha:sha,checks:[{name:'Robotics PostgreSQL 17 isolated revocation proof',sha,status:'completed',conclusion:'success'}]},
{number:976,expectedSha:sha,actualSha:sha,checks:['ATLAS Build + Production Readiness Gate','ATLAS GitHub Security Baseline'].map(name=>({name,sha,status:'completed',conclusion:'success'}))},
{number:948,expectedSha:sha,actualSha:sha,checks:[{name:'ATLAS Secure Data Room PostgreSQL 777',sha,status:'completed',conclusion:'success'}]},
{number:977,expectedSha:sha,actualSha:sha,checks:[{name:'ATLAS AI Council Security Gates',sha,status:'completed',conclusion:'success'}]}],
foundationBootstrapCertified:true,rulesetEnforcementCertified:true,revocationCertified:true};}
test('missing required check blocks',()=>{const f=base();f.prs[0].checks=[];assert.equal(validate(f).ok,false)});
test('duplicate required check blocks',()=>{const f=base();f.prs[0].checks.push({...f.prs[0].checks[0]});assert.equal(validate(f).ok,false)});
test('stale check SHA blocks',()=>{const f=base();f.prs[0].checks[0].sha='b'.repeat(40);assert.equal(validate(f).ok,false)});
test('cancelled run blocks',()=>{const f=base();f.prs[0].checks[0].conclusion='cancelled';assert.equal(validate(f).ok,false)});
test('ruleset enforcement absent blocks despite green checks',()=>{const f=base();f.rulesetEnforcementCertified=false;assert.ok(validate(f).blockers.includes('P0_RULESET_ENFORCEMENT_UNPROVEN'))});
test('draft alone cannot prove ruleset enforcement',()=>{const f=base();f.rulesetEnforcementCertified=false;f.draft=true;assert.equal(validate(f).ok,false)});
