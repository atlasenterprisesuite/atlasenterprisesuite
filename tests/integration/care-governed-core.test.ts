import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20261007081500_atlas_care_core.sql','utf8');
const api=readFileSync('apps/web/src/modules/care/careApi.ts','utf8');
const routes=readFileSync('apps/web/src/modules/care/CareRoutes.tsx','utf8');
const registry=readFileSync('apps/web/src/modules/registry.ts','utf8');
const resolver=readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx','utf8');
const permissions=readFileSync('packages/core/src/permissions.ts','utf8');

describe('ATLAS Care governed core',()=>{
  it('persists care participants, caregivers, plans and timecards under RLS and audit',()=>{
    for(const table of ['care_people','care_caregivers','care_plans','care_time_entries']){
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.audit_row_change()');
    expect(migration).toContain("public.has_identity_permission(org_id,'care.read')");
    expect(migration).toContain("('owner','care.approve')");
    for(const permission of ["'care.read'","'care.write'","'care.approve'"]) expect(permissions).toContain(permission);
  });

  it('fails closed on eligibility, caregiver credentials, overlap and weekly allowance',()=>{
    for(const gate of [
      'participant_not_eligible',
      'caregiver_not_authorized',
      'caregiver_certification_not_verified',
      'overlapping_time_entry',
      'authorized_minutes_exceeded'
    ]) expect(migration).toContain(gate);
    expect(migration).toContain("payer_eligibility',jsonb_build_object('status','blocked'");
    expect(migration).toContain("ehr_exchange',jsonb_build_object('status','blocked'");
  });

  it('exposes governed participant-to-payroll workflow actions',()=>{
    for(const rpc of [
      'care_create_participant',
      'care_create_caregiver',
      'care_create_plan',
      'care_create_time_entry',
      'care_transition_time_entry',
      'care_get_capability_readiness'
    ]){
      expect(api).toContain(rpc);
      expect(migration).toContain(`function public.${rpc}`);
    }
    for(const label of ['Participants','Caregivers','Care Plans','Timecards','Readiness']) expect(routes).toContain(label);
    expect(routes).toContain('Payroll handoff ready');
    expect(routes).toContain('ATLAS Care does not simulate Medicaid/payer eligibility');
  });

  it('registers /care as authenticated and external-gated until payer/EHR providers are verified',()=>{
    const start=registry.indexOf("id: 'care'");
    expect(start).toBeGreaterThanOrEqual(0);
    const block=registry.slice(start,registry.indexOf('\n  {',start+1));
    expect(block).toContain("route: '/care'");
    expect(block).toContain("readiness: 'external-gated'");
    expect(block).toContain('requiresAuth: true');
    expect(resolver).toContain("pathname === '/care'");
    expect(resolver).toContain('<CareRoutes />');
  });
});
