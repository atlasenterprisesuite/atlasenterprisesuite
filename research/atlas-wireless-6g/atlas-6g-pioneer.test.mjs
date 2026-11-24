import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReadiness, simulateScenario, REQUIREMENTS} from './atlas-6g-pioneer.mjs';
test('missing evidence fails closed and never enables commercial services',()=>{
  const x=evaluateReadiness(); assert.equal(x.evidenceComplete,false);
  assert.equal(x.service6gReady,false); assert.equal(x.commercialActivationAllowed,false);
  assert.equal(x.checks.length,REQUIREMENTS.length);
});
test('complete research evidence still cannot authorize live 6G',()=>{
  const evidence=Object.fromEntries(REQUIREMENTS.map(k=>[k,{verified:true,reference:'test-evidence',verifiedAt:'2025-01-01'}]));
  const x=evaluateReadiness(evidence); assert.equal(x.evidenceComplete,true);
  assert.equal(x.service6gReady,false); assert.equal(x.commercialActivationAllowed,false);
});
test('invalid evidence and future evidence cannot pass',()=>{
  assert.throws(()=>evaluateReadiness(null),TypeError);
  assert.equal(evaluateReadiness({standards_traceability:{verified:true,reference:'doc',verifiedAt:'2999-01-01'}}).checks[0].verified,false);
});
test('synthetic congestion demonstrates loss without claiming measurement',()=>{
  const x=simulateScenario({offeredMbps:150,capacityMbps:100,baseLatencyMs:10});
  assert.equal(x.deliveredMbps,100); assert.ok(x.estimatedLossPercent>33 && x.estimatedLossPercent<34);
  assert.equal(x.observed,false); assert.equal(x.provenance,'synthetic_model');
});
test('idle simulation and invalid boundary cases',()=>{
  const x=simulateScenario({offeredMbps:0,capacityMbps:100,baseLatencyMs:10});
  assert.equal(x.estimatedLossPercent,0); assert.equal(x.modeledLatencyMs,10);
  for (const bad of [null,{}, {offeredMbps:10,capacityMbps:0,baseLatencyMs:5},{offeredMbps:Infinity,capacityMbps:10,baseLatencyMs:5}])
    assert.throws(()=>simulateScenario(bad));
});
