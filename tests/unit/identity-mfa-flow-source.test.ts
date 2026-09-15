import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS Identity canonical MFA flow', () => {
  it('provides TOTP factor discovery, enrollment, challenge, and verification in the shared session client', () => {
    const session = source('apps/web/src/lib/atlasSession.ts');

    expect(session).toContain('export async function getAtlasMfaState');
    expect(session).toContain('export async function enrollAtlasTotp');
    expect(session).toContain('export async function verifyAtlasMfa');
    expect(session).toContain('/auth/v1/factors');
    expect(session).toContain('/challenge');
    expect(session).toContain('/verify');
    expect(session).toContain("factor_type: 'totp'");
  });

  it('steps privileged owner/admin sessions up to AAL2 before entering the workspace', () => {
    const page = source('apps/web/src/identity/IdentityPage.tsx');

    expect(page).toContain('getAtlasMfaState');
    expect(page).toContain('enrollAtlasTotp');
    expect(page).toContain('verifyAtlasMfa');
    expect(page).toContain("organization.role === 'owner' || organization.role === 'admin'");
    expect(page).toContain("currentLevel !== 'aal2'");
    expect(page).toContain('Enroll authenticator');
    expect(page).toContain('Verify authenticator');
    expect(page).toContain('6-digit code');
  });
});
