import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const functionRoot = resolve(root, 'supabase/functions/atlas-ride-compliance');
const indexSource = readFileSync(resolve(functionRoot, 'index.ts'), 'utf8');
const contextSource = readFileSync(resolve(functionRoot, '_shared/context.ts'), 'utf8');
const errorsSource = readFileSync(resolve(functionRoot, '_shared/errors.ts'), 'utf8');
const storageSource = readFileSync(resolve(functionRoot, '_shared/storage.ts'), 'utf8');
const repositorySource = readFileSync(resolve(functionRoot, '_shared/repository.ts'), 'utf8');

describe('ATLAS Ride compliance edge boundary', () => {
  it('exposes only governed compliance operations', () => {
    expect(indexSource).toContain("case 'requirements'");
    expect(indexSource).toContain("case 'profile-photo'");
    expect(indexSource).toContain("case 'submit-profile-photo'");
    expect(indexSource).toContain("case 'preview'");
    expect(indexSource).toContain("case 'timeline'");
    expect(indexSource).toContain("case 'approve'");
    expect(indexSource).toContain("case 'reject'");
  });

  it('keeps privileged storage credentials out of the router and biometric fiction out of the service', () => {
    expect(contextSource).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(indexSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(indexSource).not.toMatch(/face[_ -]?match|biometric[_ -]?score|confidence[_ -]?score/i);
  });

  it('binds every request to an explicit active organization when provided', () => {
    expect(contextSource).toContain("req.headers.get('x-atlas-org-id')");
    expect(contextSource).toContain("membershipQuery.eq('org_id', requestedOrg)");
    expect(contextSource).toContain("'organization_membership_required'");
    expect(contextSource).toContain("'invalid_organization'");
    expect(errorsSource).toContain('authorization, apikey, content-type, x-atlas-org-id');
  });

  it('uses short-lived signed previews and server-side transition checks', () => {
    expect(storageSource).toMatch(/createSignedUrl\([^,]+,\s*300\)/);
    expect(storageSource).toContain('atlas-compliance-evidence');
    expect(repositorySource).toContain('listRideRequirements');
    expect(indexSource).toContain('calculateRideReadiness');
    expect(repositorySource).toContain('canTransitionRequirement');
    expect(repositorySource).toContain('canTransitionSubmission');
    expect(repositorySource).toContain('state_conflict');
  });
});
