import { describe, expect, it } from 'vitest';
import { assessSpatialEnterpriseDispatch, type SpatialJobIntent,
  type SpatialEnterprisePolicy, type SpatialDispatchEvidence
} from '../../packages/creator/spatial_enterprise_policy';

const job: SpatialJobIntent = {
  tenantId: 'tenant-a', orgId: 'org-a', actorId: 'actor-a',
  idempotencyKey: 'spatial_001', fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  capability: 'text-to-3d'
};
const policy: SpatialEnterprisePolicy = {
  enabled: true,
  allowedCapabilities: ['text-to-3d', 'image-to-3d', 'procedural-obj'],
  allowedProviderIds: ['atlas-spatial-native'],
  allowExternalProcessing: false,
  permittedRegions: ['us-east-1'],
  maxConcurrentJobs: 3, maxMonthlySpendCents: 3000,
  maxRetentionDays: 7
};
const evidence: SpatialDispatchEvidence = {
  tenantId: 'tenant-a', orgId: 'org-a', actorId: 'actor-a',
  permissions: ['creator.spatial.generate', 'creator.spatial.billable'],
  providerId: 'atlas-spatial-native', providerState: 'verified',
  providerLicensed: true, providerExternal: false,
  executionRegion: 'us-east-1', encryptedAtRest: true, encryptedInTransit: true,
  activeJobs: 1, monthlySpentCents: 100, estimatedCostCents: 200,
  approvedSpendCents: 200, retentionDays: 7,
  existingJob: null
};
const check = (j=job,p=policy,e=evidence) => assessSpatialEnterpriseDispatch(j,p,e);
const deny = (reason: string, j=job,p=policy,e=evidence) =>
  expect(check(j,p,e)).toEqual({allowed:false,reason});

describe('ATLAS enterprise 3D dispatch contract (no I/O or privilege grants)', () => {
  it('passes a bounded, verified, licensed, locally hosted request with explicit budget', () => {
    expect(check()).toEqual({allowed:true,action:'enqueue',providerId:'atlas-spatial-native',billable:true});
  });
  it('refuses missing or cross-tenant authorization before any task', () => {
    deny('scope_mismatch',{...job,orgId:'org-b'});
    deny('scope_mismatch',job,policy,{...evidence,tenantId:'tenant-b'});
    deny('missing_permission',job,policy,{...evidence,permissions:[]});
    deny('policy_disabled',job,{...policy,enabled:false});
    deny('invalid_job',{...job,idempotencyKey:'../../admin'});
    deny('invalid_job',{...job,fingerprint:''});
  });
  it('fails closed for unavailable, unlicensed or unlisted execution engines', () => {
    deny('provider_unverified',job,policy,{...evidence,providerState:'unverified'});
    deny('provider_unlicensed',job,policy,{...evidence,providerLicensed:false});
    deny('provider_disallowed',job,{...policy,allowedProviderIds:[]});
    deny('capability_disallowed',{...job,capability:'rigging'});
  });
  it('enforces local processing, region, encryption and retention', () => {
    deny('external_processing_forbidden',job,policy,{...evidence,providerExternal:true});
    deny('region_disallowed',job,policy,{...evidence,executionRegion:'eu-central-1'});
    deny('encryption_missing',job,policy,{...evidence,encryptedAtRest:false});
    deny('encryption_missing',job,policy,{...evidence,encryptedInTransit:false});
    deny('retention_disallowed',job,policy,{...evidence,retentionDays:8});
    deny('retention_disallowed',job,policy,{...evidence,retentionDays:0});
  });
  it('enforces budget, per-org concurrency and explicit billable permission', () => {
    deny('concurrency_limit',job,policy,{...evidence,activeJobs:3});
    deny('budget_exceeded',job,policy,{...evidence,monthlySpentCents:2900});
    deny('spend_not_approved',job,policy,{...evidence,approvedSpendCents:199});
    deny('missing_billable_permission',job,policy,{...evidence,permissions:['creator.spatial.generate']});
    deny('invalid_accounting',job,policy,{...evidence,estimatedCostCents:-1});
    const free = {...evidence,estimatedCostCents:0,approvedSpendCents:0,permissions:['creator.spatial.generate']};
    expect(check({...job,capability:'procedural-obj'},policy,free))
      .toEqual({allowed:true,action:'enqueue',providerId:'atlas-spatial-native',billable:false});
  });
  it('deduplicates only exact same-scope, same-fingerprint stored tasks', () => {
    const existing = {tenantId:'tenant-a',orgId:'org-a',jobId:'job-123',
      idempotencyKey:'spatial_001',fingerprint:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
    expect(check(job,policy,{...evidence,existingJob:existing}))
      .toEqual({allowed:true,action:'return-existing',jobId:'job-123',billable:false});
    deny('idempotency_conflict',job,policy,{...evidence,existingJob:{...existing,fingerprint:'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}});
    deny('idempotency_conflict',job,policy,{...evidence,existingJob:{...existing,orgId:'org-b'}});
  });
});
