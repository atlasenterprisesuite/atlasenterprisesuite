import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source=readFileSync('apps/web/src/lib/eventsApi.ts','utf8');
const routes=readFileSync('apps/web/src/modules/events/EventsRoutes.tsx','utf8');

describe('events operational release contract',()=>{
  it('scopes all writes to active organization',()=>{
    expect(source).toContain('getActiveAtlasOrganization');
    expect(source).toContain('tenant_id:organization.id');
    expect(source).toContain('organization_id:organization.id');
  });
  it('creates settlements only as unpaid drafts from the browser',()=>{
    expect(source).toContain("status:'draft'");
    expect(source).toContain('payment_evidence_reference:null');
    expect(routes).toContain('Creating a settlement does not mark it paid');
  });
  it('exposes operational route depth',()=>{
    for(const path of ['/events/new','/events/venues','/events/talent','/events/production','/events/settlement']) expect(routes).toContain(path);
  });
  it('states external provider boundary explicitly',()=>{
    expect(routes).toContain('External ticketing, payments and artist-booking providers remain fail-closed');
  });
});
