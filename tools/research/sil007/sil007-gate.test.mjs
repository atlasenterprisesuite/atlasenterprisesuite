import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSil007 } from './sil007-gate.mjs';
const baseline={
 sampleId:'S1', sectionId:'SEC1', horizonId:'H1', sourceUri:'https://example.org/geology/1',
 rawSha256:'a'.repeat(64), ageModel:'Ar-Ar volcanic marker', ageUncertainty:5000,
 qcPassed:true, contaminationDetected:false, independentReplication:true,
 independentPositiveTechnologicalIndicators:true, alternativesTested:true,
 independentExpertReview:true, peerScrutiny:true, synthetic:false
};
test('rejects malformed record',()=>assert.equal(assessSil007(null).level,'E0'));
test('full hypothetical gates do not imply discovery',()=>assert.deepEqual(assessSil007(baseline),{level:'E5',permitted:true,reasons:[]}));
test('blocks contaminated result',()=>assert.equal(assessSil007({...baseline,contaminationDetected:true}).permitted,false));
test('blocks missing SHA',()=>assert.equal(assessSil007({...baseline,rawSha256:'bad'}).level,'E1'));
test('blocks absent chronology',()=>assert.equal(assessSil007({...baseline,ageModel:''}).permitted,false));
test('blocks absent independent replication',()=>assert.equal(assessSil007({...baseline,independentReplication:false}).level,'E1'));
test('alternatives eliminated without positive evidence is not technology',()=>assert.equal(assessSil007({...baseline,independentPositiveTechnologicalIndicators:false}).level,'E3'));
test('positive evidence without independent review cannot be confirmed',()=>assert.deepEqual(assessSil007({...baseline,peerScrutiny:false}).level,'E4'));
test('synthetic fixtures never promoted',()=>assert.equal(assessSil007({...baseline,synthetic:true}).level,'E0'));
