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

  it('loads the active organization display name through the authenticated session', () => {
    const source = readFileSync(sessionPath, 'utf8');
    expect(source).toContain('name: string');
    expect(source).toContain('/rest/v1/organizations?');
    expect(source).toContain('select=id,name,legal_name,active');
  });

  it('binds the shell header to live session identity and reacts to session changes', () => {
    const source = readFileSync(shellPath, 'utf8');
    expect(source).toContain('getActiveAtlasOrganization');
    expect(source).toContain('ATLAS_SESSION_EVENT');
    expect(source).toContain('organization.name');
    expect(source).toContain('organization.role');
  });
});
