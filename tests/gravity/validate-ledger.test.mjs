import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGravityLedger} from '../../scripts/gravity/validate-ledger.mjs';
const A='a'.repeat(40), B='b'.repeat(40);
const ledger={nodes:[{id:'976',expectedHead:A,requiredChecks:['council-security']},{id:'974',expectedHead:B,requiredChecks:['council-security']}],edges:[{from:'976',to:'974',evidence:{kind:'workflow-contract',reference:'explicit fixture'}}]};
const observed={'976':{head:A,rulesetCertified:true,checks:{'council-security':{head:A,status:'completed',conclusion:'success'}}},'974':{head:B,rulesetCertified:true,checks:{'council-security':{head:B,status:'completed',conclusion:'success'}}}};
test('valid evidence-backed fixture',()=>assert.equal(validateGravityLedger(ledger,observed).go,true));
test('stale HEAD blocks',()=>assert.equal(validateGravityLedger(ledger,{...observed,'976':{...observed['976'],head:B}}).go,false));
for(const status of ['failure','pending','cancelled','queued','skipped','neutral']) test(status+' check blocks',()=>{
 const altered=structuredClone(observed);altered['976'].checks['council-security'].conclusion=status;assert.equal(validateGravityLedger(ledger,altered).go,false);
});
test('missing required check blocks',()=>{const o=structuredClone(observed);delete o['976'].checks['council-security'];assert.equal(validateGravityLedger(ledger,o).go,false)});
test('uncertified ruleset blocks',()=>{const o=structuredClone(observed);o['976'].rulesetCertified=false;assert.equal(validateGravityLedger(ledger,o).go,false)});
test('unproven dependency blocks',()=>assert.equal(validateGravityLedger({...ledger,edges:[{from:'976',to:'974'}]},observed).go,false));
test('cycle blocks',()=>assert.equal(validateGravityLedger({...ledger,edges:[...ledger.edges,{from:'974',to:'976',evidence:{kind:'workflow-contract',reference:'fixture'}}]},observed).go,false));
