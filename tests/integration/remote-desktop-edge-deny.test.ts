import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const edge = readFileSync('supabase/functions/atlas-local-control/index.ts', 'utf8');

describe('Remote desktop server-side fail-closed boundary', () => {
  it('rejects desktop commands on the authenticated Edge path before database enqueue', () => {
    const handler = edge.slice(edge.indexOf("if (operation === 'commands.enqueue')"));
    const block = handler.indexOf("if (capability.startsWith('remote.desktop.'))");
    const insert = handler.indexOf(".from('atlas_local_device_commands').insert(");
    expect(block).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(block);
    expect(handler).toContain("throw new EdgeError('remote_desktop_session_verification_required', 409)");
  });
  it('preserves tenant membership and permission checks for command enqueue', () => {
    expect(edge).toContain(".eq('org_id', requestedOrgId)");
    expect(edge).toContain("requirePermission(context, 'device.agent.use')");
  });
  it('keeps agent revocation and session invalidation', () => {
    expect(edge).toContain("status: 'revoked', mtls_status: 'revoked'");
    expect(edge).toContain(".from('atlas_local_agent_sessions').update({ revoked_at:");
  });
});
