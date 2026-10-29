import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const edge = readFileSync('supabase/functions/atlas-secure-data-room/index.ts', 'utf8');
const http = readFileSync('packages/security/secure-data-room-http.ts', 'utf8');

describe('Secure Data Room 777 release-denial contract', () => {
  it('retains explicit closed session state until authoritative revocation exists', () => {
    expect(edge).toContain('sessionActive: false');
    expect(edge).toContain('document: async () => null');
    expect(edge).toContain('membership: async () => null');
    expect(edge).toContain('grant: async () => false');
  });
  it('does not expose document bytes or signed URLs from the HTTP boundary', () => {
    expect(http).not.toContain('createSignedUrl');
    expect(http).not.toContain('download(');
    expect(http).toContain('new Response(null');
  });
  it('does not embed a service role credential in the edge entrypoint', () => {
    expect(edge).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
