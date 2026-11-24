import test from 'node:test';
import assert from 'node:assert/strict';
import {selectInferenceRoute,evaluateSyncOperation} from '../lib/hybrid-offline-policy.mjs';

test('local inference never escalates to cloud',()=>{
  assert.throws(()=>selectInferenceRoute({preferred:'device-local',online:true,cloudAuthorized:true}),/offline_route_unavailable/);
  assert.deepEqual(selectInferenceRoute({preferred:'device-local',deviceAvailable:true}),{mode:'device-local',network:'none'});
});
test('LAN requires pairing and availability',()=>{
  assert.throws(()=>selectInferenceRoute({preferred:'lan-paired',lanAvailable:true}),/offline_route_unavailable/);
  assert.equal(selectInferenceRoute({preferred:'lan-paired',lanAvailable:true,paired:true}).network,'lan');
});
test('cloud requires both connectivity and explicit authorization',()=>{
  assert.throws(()=>selectInferenceRoute({preferred:'cloud',online:true}),/offline_route_unavailable/);
  assert.equal(selectInferenceRoute({preferred:'cloud',online:true,cloudAuthorized:true}).network,'internet');
});
const operation={id:'op-1',tenantId:'tenant-a',actorId:'actor-a',idempotencyKey:'key-1'};
const principal={tenantId:'tenant-a',actorId:'actor-a'};
const authorization={tenantId:'tenant-a',actorId:'actor-a',allowed:true,fresh:true};
test('sync fails closed on missing authorization',()=>{
  assert.throws(()=>evaluateSyncOperation({operation,principal}),/sync_authorization_required/);
});
test('sync rejects cross-tenant and actor spoofing',()=>{
  assert.throws(()=>evaluateSyncOperation({operation,principal:{...principal,tenantId:'tenant-b'},authorization}),/sync_identity_mismatch/);
  assert.throws(()=>evaluateSyncOperation({operation,principal:{...principal,actorId:'actor-b'},authorization}),/sync_identity_mismatch/);
});
test('sync rejects stale or revoked authorization',()=>{
  assert.throws(()=>evaluateSyncOperation({operation,principal,authorization:{...authorization,fresh:false}}),/sync_denied/);
  assert.throws(()=>evaluateSyncOperation({operation,principal,authorization:{...authorization,allowed:false}}),/sync_denied/);
});
test('sync accepts only explicitly authorized proposal',()=>{
  assert.deepEqual(evaluateSyncOperation({operation,principal,authorization}),{accepted:true,idempotencyKey:'key-1'});
});
