import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const shellPath = resolve(root, 'apps/web/src/components/AtlasShell.tsx');
const sessionPath = resolve(root, 'apps/web/src/lib/atlasSession.ts');

describe('ATLAS shell live organization identity', () => {
  it('does not render demo tenant identity in the production shell', () => {
    const source = readFileSync(shellPath, 'utf8');
    expect(source).not.toContain('ATLAS Demo Organization');
    expect(source).not.toContain('tenant-demo / org-demo');
    expect(source).not.toContain('READ ONLY');
    expect(source).not.toContain('Demo adapter');
  });

  it('loads shell organization metadata without changing the accounting organization contract', () => {
    const source = readFileSync(sessionPath, 'utf8');
    expect(source).toContain('export type AtlasShellOrganization');
    expect(source).toContain('getActiveAtlasShellOrganization');
    expect(source).toContain('organizations!organization_members_org_id_fkey(id,name,legal_name,active)');
    expect(source).toContain('return { id: String(data[0].org_id), role: String(data[0].role || \'member\') };');
  });

  it('binds the shell header to live session identity and reacts to session changes', () => {
    const source = readFileSync(shellPath, 'utf8');
    expect(source).toContain('getActiveAtlasShellOrganization');
    expect(source).toContain('ATLAS_SESSION_EVENT');
    expect(source).toContain('organization.name');
    expect(source).toContain('organization.role');
  });
});
