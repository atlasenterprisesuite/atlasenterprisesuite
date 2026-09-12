import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const rideRoot = resolve(root, 'apps/web/src/modules/ride');
const rideSources = readdirSync(rideRoot)
  .filter((name) => /\.(tsx|ts)$/.test(name))
  .map((name) => readFileSync(resolve(rideRoot, name), 'utf8'))
  .join('\n');
const apiSource = readFileSync(resolve(root, 'apps/web/src/lib/rideComplianceApi.ts'), 'utf8');
const edgeIndex = readFileSync(resolve(root, 'supabase/functions/atlas-ride-compliance/index.ts'), 'utf8');
const edgeContext = readFileSync(resolve(root, 'supabase/functions/atlas-ride-compliance/_shared/context.ts'), 'utf8');
const baseMigration = readFileSync(resolve(root, 'supabase/migrations/20260912_ride_profile_photo_compliance.sql'), 'utf8');
const hardeningMigration = readFileSync(resolve(root, 'supabase/migrations/20260912_ride_profile_photo_compliance_hardening.sql'), 'utf8');

describe('ATLAS Ride compliance security regression contract', () => {
  it('contains no placeholder navigation, console logging, or biometric claims in Ride browser sources', () => {
    const allRideSources = `${rideSources}\n${apiSource}`;
    expect(allRideSources).not.toMatch(/href=["']#["']/);
    expect(allRideSources).not.toMatch(/console\.log\(/);
    expect(allRideSources).not.toMatch(/coming soon/i);
    expect(allRideSources).not.toMatch(/face[_ -]?match|biometric[_ -]?template|confidence[_ -]?score/i);
  });

  it('keeps the service role server-only', () => {
    expect(edgeContext).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edgeIndex).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(apiSource).not.toMatch(/service[_ -]?role/i);
  });

  it('keeps evidence private and requires authenticated subject scope', () => {
    expect(baseMigration).not.toMatch(/public\s*:\s*true/i);
    expect(baseMigration).toContain("'atlas-compliance-evidence'");
    expect(baseMigration).toContain('organization_members');
    expect(baseMigration).toContain('auth.uid()');
    expect(hardeningMigration).toContain('subject_user_id = auth.uid()');
    expect(hardeningMigration).toContain("status = 'uploading'");
    expect(hardeningMigration).toContain("storage_path like 'pending/%'");
    expect(hardeningMigration).toContain("cr.status in ('action_required','rejected')");
  });

  it('never grants browser access to storage objects', () => {
    const migrations = `${baseMigration}\n${hardeningMigration}`;
    expect(migrations).not.toMatch(/create policy[^;]+on\s+storage\.objects/is);
  });
});
