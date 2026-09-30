import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql=readFileSync('supabase/migrations/20260923195500_events_operational_core.sql','utf8');

describe('events operational schema',()=>{
  it('persists tenant-scoped event operations with RLS and audit',()=>{
    for(const table of ['event_venues','event_talent','events','event_production_tasks','event_settlements','event_audit_events']){
      expect(sql).toContain('public.'+table);
    }
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('event_audit_mutation');
    expect(sql).toContain('tenant_id=organization_id');
  });

  it('fails closed for paid settlements and provider verification',()=>{
    expect(sql).toContain("status<>'paid'");
    expect(sql).toContain('payment_evidence_reference is null');
    expect(sql).toContain("state<>'verified' or (provider_account_reference is not null and last_verified_at is not null)");
    expect(sql).not.toContain('events_write_event_provider_connections');
  });

  it('requires contract evidence before talent is contracted',()=>{
    expect(sql).toContain("booking_status<>'contracted' or contract_evidence_reference is not null");
  });
});
