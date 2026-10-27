import { describe, expect, it } from 'vitest';
import { validateCinemaPreflight, type CinemaRequest } from '../../packages/creator/cinema_provider_contract.ts';
const base: CinemaRequest = { organizationId:'org-a',actorId:'user-a',productionId:'film-a',providerId:'veo',
 capabilityVerified:true,permissions:['creator.generate'],actorOrganizationId:'org-a',
 estimatedCostMinor:200,approvedCostMinor:200,approvalId:'approval-a',
 approvalOrganizationId:'org-a',approvalProductionId:'film-a',
 idempotencyKey:'job-a',referenceAssetIds:['asset-a'],referenceOrganizationIds:['org-a'],auditReady:true };
describe('cinema provider fail-closed preflight',()=>{
 it('never claims a submitted or completed job',()=>expect(validateCinemaPreflight(base).status).toBe('preflight-only'));
 it.each([
  [{approvedCostMinor:199},'spend_not_approved'],
  [{approvalId:null},'spend_not_approved'],
  [{approvalProductionId:'film-b'},'spend_not_approved'],
  [{actorOrganizationId:'org-b'},'rbac_or_tenant_denied'],
  [{permissions:[]},'rbac_or_tenant_denied'],
  [{referenceOrganizationIds:['org-b']},'cross_tenant_reference'],
  [{idempotencyKey:'Bearer secret'},'invalid_idempotency_key'],
  [{auditReady:false},'audit_unavailable'],
  [{capabilityVerified:false},'provider_unverified'],
  [{estimatedCostMinor:NaN},'invalid_cost'],
 ])('blocks unsafe request %j', (patch,reason)=>{
  expect(validateCinemaPreflight({...base,...patch})).toEqual({status:'blocked',reason});
 });
 it('provider acknowledgement does not convert preflight into success',()=>{
  expect(validateCinemaPreflight({...base,providerAcknowledgementId:'fake'}).status).toBe('preflight-only');
 });
});
