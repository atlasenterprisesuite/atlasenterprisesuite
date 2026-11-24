import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const edge = readFileSync('supabase/functions/atlas-local-control/index.ts', 'utf8');
const prepare = edge.split("if (operation === 'remote.sessions.prepare') {")[1]?.split("if (operation === 'commands.enqueue') {")[0] ?? '';

describe('remote session preparation boundary (static contract; no Supabase runtime)', () => {
  it('has an explicit authenticated operation and permission gate', () => {
    expect(prepare).toContain("requirePermission(context, 'device.agent.use')");
    expect(edge).toContain("return await userOperation(req, body, operation)");
  });
  it('binds device and agent to the resolved organization', () => {
    expect(prepare).toContain(".eq('id', deviceId).eq('org_id', context.orgId)");
    expect(prepare).toContain(".eq('id', device.agent_id).eq('org_id', context.orgId)");
  });
  it('rejects missing device and offline or unbound agent', () => {
    expect(prepare).toContain("throw new EdgeError('device_not_found', 404)");
    expect(prepare).toContain("agent.status !== 'online' || agent.mtls_status !== 'active'");
  });
  it('does not issue tokens, create sessions or enqueue commands', () => {
    expect(prepare).toContain("throw new EdgeError('remote_desktop_session_verification_required', 409)");
    expect(prepare).not.toContain('.insert(');
    expect(prepare).not.toContain('session_token:');
  });
});
