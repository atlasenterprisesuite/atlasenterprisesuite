import { describe, expect, it } from 'vitest';
import { resolveHttpActor } from '../../apps/atlas-orchestrator/src/runtime/auth';
import { resolvePersistence } from '../../apps/atlas-orchestrator/src/runtime/persistence';
import { readiness, verifyReadiness } from '../../apps/atlas-orchestrator/src/runtime/readiness';
import { readFileSync } from 'node:fs';

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

  it('uses memory only when explicitly requested', () => {
    const persistence = resolvePersistence({ ATLAS_PERSISTENCE_MODE: 'memory' });
    expect(persistence.durable).toBe(false);
  });

  it('creates durable Supabase persistence with a service-role credential', () => {
    const persistence = resolvePersistence({
      ATLAS_PERSISTENCE_MODE: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });
    expect(persistence.durable).toBe(true);
  });

  it('creates durable Supabase RPC persistence only with a server secret', () => {
    const persistence = resolvePersistence({
      ATLAS_PERSISTENCE_MODE: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_server_only',
      ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN: 'runtime-token',
    });
    expect(persistence.durable).toBe(true);
  });

  it('probes the durable backend before reporting runtime readiness', async () => {
    const healthy = {
      durable: true,
      listEvents: async () => [],
    } as any;
    const unhealthy = {
      durable: true,
      listEvents: async () => { throw new Error('offline'); },
    } as any;

    await expect(verifyReadiness(healthy, scope)).resolves.toEqual({ ready: true, reason: null });
    await expect(verifyReadiness(unhealthy, scope)).resolves.toEqual({ ready: false, reason: 'persistence_unreachable' });
  });

  it('binds the HTTP runtime to managed-host PORT on all interfaces', () => {
    const source = readFileSync('apps/atlas-orchestrator/src/http.ts', 'utf8');
    expect(source).toContain('process.env.PORT ?? process.env.ATLAS_MCP_PORT');
    expect(source).toContain("server.listen(port, '0.0.0.0'");
    expect(source).toContain('verifyReadiness(runtime.persistence, scope)');
  });

  it('resolves extensionless TypeScript files and directory index imports on Node hosts', () => {
    const loader = readFileSync('apps/atlas-orchestrator/atlas-ts-loader.mjs', 'utf8');
    expect(loader).toContain("ERR_UNSUPPORTED_DIR_IMPORT");
    expect(loader).toContain("${specifier}/index.ts");
    expect(loader).toContain("${specifier}.ts");
  });

  it.each([
    {},
    { ATLAS_PERSISTENCE_MODE: 'supabase' },
    { ATLAS_PERSISTENCE_MODE: 'supabase', SUPABASE_URL: 'https://example.supabase.co' },
    {
      ATLAS_PERSISTENCE_MODE: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable',
      ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN: 'runtime-token',
    },
  ])('fails closed for ambiguous or incomplete production persistence: %o', (env) => {
    expect(() => resolvePersistence(env)).toThrow(/ATLAS persistence/i);
  });
});
