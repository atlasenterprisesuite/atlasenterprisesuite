import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrivacyManifest } from '../../packages/execution/src/privacy-manifest.mjs';
const entry = {category:'contact',purpose:'account',linked:true,recipient:'local',retentionDays:30};
const manifest = {schema:'atlas.privacy.v1',module:'identity',collection:[entry]};
test('valid declarations are not runtime proof',()=>assert.deepEqual(evaluatePrivacyManifest(manifest),{status:'declared',labels:['linked'],verified:false}));
test('empty collection remains declaration only',()=>assert.deepEqual(evaluatePrivacyManifest({...manifest,collection:[]}),{status:'declared',labels:['none_declared'],verified:false}));
test('unknown schema fails closed',()=>assert.equal(evaluatePrivacyManifest({...manifest,schema:'v2'}).status,'blocked'));
test('tracking is prohibited',()=>assert.equal(evaluatePrivacyManifest({...manifest,collection:[{...entry,purpose:'tracking'}]}).status,'blocked'));
test('unknown categories and recipients fail closed',()=>{for(const e of [{...entry,category:'unknown'},{...entry,recipient:'external'}])assert.equal(evaluatePrivacyManifest({...manifest,collection:[e]}).status,'blocked');});
test('invalid retention and linkage fail closed',()=>{for(const e of [{...entry,retentionDays:Infinity},{...entry,retentionDays:0},{...entry,linked:'false'}])assert.equal(evaluatePrivacyManifest({...manifest,collection:[e]}).status,'blocked');});
test('unknown fields cannot be silently accepted',()=>assert.equal(evaluatePrivacyManifest({...manifest,collection:[{...entry,extra:true}]}).status,'blocked'));
test('malformed manifests fail closed',()=>{for(const m of [null,[],{...manifest,collection:[null]},{...manifest,module:''}])assert.equal(evaluatePrivacyManifest(m).status,'blocked');});
test('mixed declarations retain both labels',()=>assert.deepEqual(evaluatePrivacyManifest({...manifest,collection:[entry,{...entry,linked:false}]}).labels,['linked','unlinked_declared']));

import { reconcilePrivacyInventory } from '../../packages/execution/src/privacy-manifest.mjs';
const observation = {module:'identity',...entry};
const reconcile = (manifests, observations) => reconcilePrivacyInventory(JSON.stringify({manifests,observations}));
test('inventory matches metadata but never authorizes or verifies runtime',()=>assert.deepEqual(reconcile([manifest],[observation]),{status:'matched_metadata',modules:1,observations:1,matched:1,unobservedModules:0,verified:false,authorization:'not_evaluated'}));
test('unknown module is blocked',()=>assert.equal(reconcile([manifest],[{...observation,module:'unknown'}]).reason,'undeclared_observation'));
test('changed purpose recipient linkage or category is blocked',()=>{for(const e of [{purpose:'analytics'},{recipient:'atlas'},{linked:false},{category:'health'}])assert.equal(reconcile([manifest],[{...observation,...e}]).reason,'undeclared_observation');});
test('retention may be shorter but never longer',()=>{assert.equal(reconcile([manifest],[{...observation,retentionDays:1}]).status,'matched_metadata');assert.equal(reconcile([manifest],[{...observation,retentionDays:31}]).reason,'undeclared_observation');});
test('absence of observations is not proof of no collection',()=>{const result=reconcile([manifest],[]);assert.equal(result.status,'incomplete_metadata');assert.equal(result.verified,false);});
test('duplicate module declarations are blocked',()=>assert.equal(reconcile([manifest,manifest],[]).reason,'duplicate_module'));
test('malformed observations and raw data fields are rejected',()=>{for(const e of [null,{...observation,retentionDays:0},{...observation,payload:'synthetic'}])assert.equal(reconcile([manifest],[e]).reason,'invalid_observation');});
test('invalid serialized envelope is blocked',()=>{for(const input of [null,'{','{}',' '.repeat(1000001)])assert.equal(reconcilePrivacyInventory(input).status,'blocked');});
test('empty registry and missing module coverage cannot imply success',()=>{assert.equal(reconcile([],[]).status,'blocked');assert.equal(reconcile([manifest,{...manifest,module:'voice'}],[observation]).status,'incomplete_metadata');});

test('duplicate declarations cannot inflate metadata coverage',()=>{
 const duplicate={...manifest,collection:[entry,{...entry}]};
 assert.equal(evaluatePrivacyManifest(duplicate).status,'blocked');
 assert.equal(reconcile([duplicate],[observation]).reason,'invalid_manifest');
});
test('ambiguous retention declarations for the same data flow fail closed',()=>{
 const ambiguous={...manifest,collection:[entry,{...entry,retentionDays:60}]};
 assert.equal(evaluatePrivacyManifest(ambiguous).status,'blocked');
});
test('repeated observations cannot inflate the reconciliation count',()=>{
 assert.equal(reconcile([manifest],[observation,{...observation}]).reason,'duplicate_observation');
});
