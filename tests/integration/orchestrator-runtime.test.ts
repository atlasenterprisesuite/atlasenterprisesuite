import { describe, expect, it } from 'vitest';
import { resolveHttpActor } from '../../apps/atlas-orchestrator/src/runtime/auth';
import { readiness } from '../../apps/atlas-orchestrator/src/runtime/readiness';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const secrets = {
  ATLAS_MCP_OPENAI_TOKEN: 'openai-read',
  ATLAS_MCP_OPENAI_WRITE_TOKEN: 'openai-write',
  ATLAS_MCP_GEMINI_TOKEN: 'gemini-read',
  ATLAS_MCP_COPILOT_TOKEN: 'copilot-read',
  ATLAS_MCP_COPILOT_WRITE_TOKEN: 'copilot-write'
};

describe('ATLAS shared MCP runtime', () => {
  it('maps provider tokens to least-privilege actors', () => {
    const gemini = resolveHttpActor('Bearer gemini-read', scope, secrets);
    const copilot = resolveHttpActor('Bearer copilot-read', scope, secrets);
    const copilotWriter = resolveHttpActor('Bearer copilot-write', scope, secrets);

    expect(gemini.actorId).toBe('atlas-gemini-analyst');
    expect(gemini.permissions).not.toContain('ai.code.write');
    expect(copilot.permissions).not.toContain('ai.code.write');
    expect(copilotWriter.permissions).toContain('ai.code.write');
    expect(copilotWriter.permissions).not.toContain('release.deploy');
  });

  it('rejects unknown bearer tokens', () => {
    expect(() => resolveHttpActor('Bearer wrong', scope, secrets)).toThrow(/Unauthorized ATLAS MCP client/);
  });

  it('is not ready for production while persistence is non-durable', () => {
    expect(readiness({ durable: false })).toEqual({ ready: false, reason: 'persistence_not_durable' });
    expect(readiness({ durable: true })).toEqual({ ready: true, reason: null });
  });
});
