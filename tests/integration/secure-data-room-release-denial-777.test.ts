import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const edge = readFileSync('supabase/functions/atlas-secure-data-room/index.ts', 'utf8');
const http = readFileSync('packages/security/secure-data-room-http.ts', 'utf8');
const sources = readFileSync('packages/security/secure-data-room-supabase-sources.ts', 'utf8');

describe('Secure Data Room 777 predeploy release-denial contract', () => {
  it('retains explicit closed session state pending authoritative session revocation', () => {
    expect(edge).toContain('sessionActive: false');
    expect(edge).toContain('createScopedSupabaseDataRoomSources(readOne)');
    expect(edge).not.toContain('sessionActive: true');
  });
  it('requires the bearer from each request for every row lookup', () => {
    expect(edge).toContain('const readOne: DataRoomScopedRead = async (token');
    expect(edge).toContain('userClient(token)');
    expect(sources).toContain('bearerToken');
    expect(sources).toContain("'organization_members'");
    expect(sources).toContain("'atlas_data_room_grants'");
  });
  it('does not return document bytes or signed URLs from authorization-only HTTP boundary', () => {
    expect(http).not.toContain('createSignedUrl');
    expect(http).not.toContain('download(');
    expect(http).toContain('new Response(null');
  });
  it('never embeds a privileged credential into edge or scoped-source implementations', () => {
    expect(edge).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edge).not.toContain('service_role');
    expect(sources).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
