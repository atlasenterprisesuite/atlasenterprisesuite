import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  atlasInfraCorsHeaders,
  atlasInfraPreflightResponse
} from '../../supabase/functions/atlas-infra-status/cors';

const trustedOrigin = 'https://atlasenterprisesuite.com';
const frontendRequest = (origin: string) => new Request(
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-infra-status',
  { method: 'OPTIONS', headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-atlas-org-id'
  }}
);

describe('ATLAS infrastructure browser boundary — fail closed', () => {
  it('responds to authorized browser preflight without touching identity or service role', () => {
    const reply = atlasInfraPreflightResponse(frontendRequest(trustedOrigin));
    expect(reply.status).toBe(204);
    expect(reply.headers.get('access-control-allow-origin')).toBe(trustedOrigin);
    expect(reply.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
    const headers = reply.headers.get('access-control-allow-headers') || '';
    for (const name of ['authorization','apikey','content-type','x-atlas-org-id']) {
      expect(headers).toContain(name);
    }
    expect(reply.headers.get('access-control-allow-credentials')).toBeNull();
    expect(reply.headers.get('vary')).toContain('Origin');
  });

  it('allows the www origin and the project browser origin, never wildcard', () => {
    for (const origin of [
      'https://www.atlasenterprisesuite.com',
      'https://ggmanzcgtlrvqfoccgsh.supabase.co'
    ]) {
      expect(atlasInfraPreflightResponse(frontendRequest(origin)).headers.get('access-control-allow-origin')).toBe(origin);
    }
    expect(atlasInfraCorsHeaders(trustedOrigin)['access-control-allow-origin']).not.toBe('*');
  });

  it('does not grant access to untrusted or lookalike origins', () => {
    for (const origin of [
      'https://atlasenterprisesuite.com.evil.example',
      'http://atlasenterprisesuite.com',
      'https://untrusted.example',
      'null'
    ]) {
      const response = atlasInfraPreflightResponse(frontendRequest(origin));
      expect(response.status).toBe(403);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    }
    expect(atlasInfraCorsHeaders(null)['access-control-allow-origin']).toBeUndefined();
  });

  it('binds GET and error replies to the origin and authorizes the exact requested organization', () => {
    const source = readFileSync('supabase/functions/atlas-infra-status/index.ts', 'utf8');
    expect(source).toContain('atlasInfraPreflightResponse(req)');
    expect(source).toContain('atlasInfraCorsHeaders(req.headers.get(\'origin\'))');
    expect(source).toMatch(/if\s*\(req\.method\s*===\s*'OPTIONS'\)/);
    expect(source).toMatch(/\.eq\('user_id',\s*userData\.user\.id\)/);
    expect(source).toContain("req.headers.get('x-atlas-org-id')");
    expect(source).toContain(".eq('org_id', requestedOrgId)");
    expect(source).toContain('invalid_organization_id');
    expect(source).toContain("infrastructure_admin_required");
    expect(source).toMatch(/return json\(req, \{\s*ok: true/);
  });
});
