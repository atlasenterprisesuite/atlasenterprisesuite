import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const commandCenter = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudCommandCenter.tsx',
  'utf8'
);
const cloudApi = readFileSync(
  'apps/web/src/modules/cloud/cloudApi.ts',
  'utf8'
);
const nextLevel = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx',
  'utf8'
);
const domains = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudDomains.tsx',
  'utf8'
);
const operations = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudOperations.tsx',
  'utf8'
);
const verification = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudProductionVerification.tsx',
  'utf8'
);
const routes = readFileSync(
  'apps/web/src/modules/cloud/AtlasCloudRoutes.tsx',
  'utf8'
);

describe('ATLAS Cloud final audit contract', () => {
  it('uses one authenticated session client for protected Cloud API calls', () => {
    expect(cloudApi).toContain('atlasAuthorizedJson');
    expect(cloudApi).toContain('getActiveAtlasOrganization');
    expect(cloudApi).toContain('getCachedAtlasShellOrganization');
    expect(cloudApi).toContain("'x-atlas-org-id': orgId");

    for (const source of [nextLevel, domains, operations, verification]) {
      expect(source).toContain("from './cloudApi'");
      expect(source).not.toContain("localStorage.getItem('atlas_access_token')");
      expect(source).not.toContain('ggmanzcgtlrvqfoccgsh.supabase.co');
    }
  });

  it('promotes the audited command center to the canonical Cloud home', () => {
    expect(routes).toContain("from './AtlasCloudCommandCenter'");
    expect(routes).toContain('return <AtlasCloudCommandCenter />;');
    expect(commandCenter).toContain('ATLAS CLOUD');
    expect(commandCenter).toContain('Canonical control path');
    expect(commandCenter).toContain('Available operations');
    expect(commandCenter).toContain('Governed hierarchy model');
  });

  it('implements search rather than rendering a decorative search box', () => {
    expect(commandCenter).toContain("const [query, setQuery] = useState('')");
    expect(commandCenter).toContain('searchResults');
    expect(commandCenter).toContain('onChange={(event) => setQuery(event.target.value)}');
    expect(commandCenter).toContain('ATLAS Cloud search results');
  });

  it('shows authenticated organization context without fake interactive selectors', () => {
    expect(commandCenter).toContain('getCachedAtlasShellOrganization');
    expect(commandCenter).toContain('ATLAS_SESSION_EVENT');
    expect(commandCenter).toContain("organization?.name");
    expect(commandCenter).toContain("organization?.role");
    expect(commandCenter).not.toContain('aria-label="Current organization"');
    expect(commandCenter).not.toContain('aria-label="Current environment"');
  });

  it('does not advertise write capabilities that are not implemented', () => {
    for (const falseAction of ['Deploy application', 'Create database', 'Add domain', 'Create API']) {
      expect(commandCenter).not.toContain(falseAction);
    }
    for (const realAction of [
      'Create project',
      'Verify domain DNS',
      'Inspect API contract',
      'Review releases',
      'Verify production',
      'Open automations'
    ]) {
      expect(commandCenter).toContain(realAction);
    }
  });

  it('keeps overview health evidence-only instead of hard-coding green/red truth', () => {
    expect(commandCenter).toContain('Authoritative verification surfaces');
    expect(commandCenter).toContain('does not invent green/red health');
    expect(commandCenter).not.toContain("state: 'in_progress'");
    expect(commandCenter).not.toContain("state: 'warning'");
    expect(commandCenter).not.toContain('Live control path');
    expect(commandCenter).not.toContain('Recent Activity');
  });
});
