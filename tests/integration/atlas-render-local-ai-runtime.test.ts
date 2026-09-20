import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const http = readFileSync('apps/atlas-orchestrator/src/http.ts', 'utf8');
const toolExecutor = readFileSync('packages/atlas-mcp/src/toolExecutor.ts', 'utf8');
const orchestrator = readFileSync('packages/ai-core/src/orchestrator.ts', 'utf8');
const install = readFileSync('scripts/install-render-local-ai.mjs', 'utf8');
const start = readFileSync('scripts/start-atlas-orchestrator.mjs', 'utf8');
const migration = readFileSync('supabase/migrations/20260919034000_atlas_render_free_local_ai.sql', 'utf8');
const identityReuseMigration = readFileSync('supabase/migrations/20260919034500_atlas_render_existing_identity.sql', 'utf8');
const bootstrap = readFileSync('supabase/functions/atlas-local-ai-bootstrap/index.ts', 'utf8');
const workflow = readFileSync('.github/workflows/atlas-render-local-ai-verify.yml', 'utf8');

describe('ATLAS Render free local AI runtime contract', () => {
  it('removes Node strip-only parameter properties from the orchestrator import path', () => {
    expect(toolExecutor).not.toContain('constructor(private readonly');
    expect(orchestrator).not.toContain('constructor(private readonly');
    expect(toolExecutor).toContain('this.options = options');
    expect(orchestrator).toContain('this.options = options');
  });

  it('installs a pinned verified llama.cpp CPU artifact only in Render builds', () => {
    expect(install).toContain("process.env.RENDER !== 'true'");
    expect(install).toContain('llama-b11046-bin-ubuntu-x64.tar.gz');
    expect(install).toContain('ca14dec04b4c5725b6373681cc3685c5dbb914301f7f8be6c89649c0a68734a9');
    expect(install).toContain("findFile(runtimeDir, 'llama-server')");
    expect(install).toContain("sha256(archive) !== llamaSha256");
    expect(install).not.toContain('llama.app/install.sh');
    expect(install).toContain('SmolLM2-135M-Instruct-Q4_K_M.gguf');
  });

  it('keeps llama on loopback and exposes only the authenticated proxy', () => {
    expect(start).toContain("'--host', '127.0.0.1'");
    expect(start).toContain("findFile(runtimeDir, 'llama-server')");
    expect(start).toContain('LD_LIBRARY_PATH');
    expect(start).toContain("ATLAS_LOCAL_AI_INTERNAL_URL");
    expect(start).not.toContain("'--host', '0.0.0.0'");
    expect(http).toContain("req.url === '/local-ai/health'");
    expect(http).toContain("req.url === '/local-ai/v1/responses'");
    expect(http).toContain('timingSafeEqual');
    expect(http).toContain('ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN');
    expect(http).toContain("internal.startsWith('http://127.0.0.1:')");
  });

  it('copies the existing governed runtime identity inside Vault without returning it', () => {
    expect(migration).toContain("name = 'atlas_orchestrator_runtime_token'");
    expect(migration).toContain("'atlas_local_ai_runtime_token'");
    expect(migration).toContain('vault.create_secret');
    expect(migration).toContain('vault.update_secret');
    expect(migration).toContain("'https://atlas-sovereign-orchestrator.onrender.com/local-ai'");
    expect(migration).toContain("'render-free'");
  });

  it('can reuse the existing governed orchestrator identity without duplicating it', () => {
    expect(identityReuseMigration).toContain("'credential_mode', 'existing_orchestrator_identity'");
    expect(identityReuseMigration).toContain("name='atlas_local_ai_runtime_token'");
    expect(identityReuseMigration).toContain("name='atlas_orchestrator_runtime_token'");
    expect(identityReuseMigration).not.toContain('vault.create_secret');
    expect(identityReuseMigration).not.toContain('vault.update_secret');
    expect(identityReuseMigration).toContain('grant execute on function public.atlas_get_local_ai_runtime_config() to service_role');
  });

  it('allocates production context headroom for the Render local runtime', () => {
    expect(start).toContain('ATLAS_RENDER_LOCAL_AI_CONTEXT_SIZE');
    expect(start).toContain("|| '8192'");
    expect(start).toContain('Math.max(4096');
    expect(start).toContain("'-c', localContext");
    expect(start).not.toContain("'-c', '512'");
  });

  it('requires a production-sized real response inference before Render becomes verified', () => {
    expect(bootstrap).toContain("source !== 'render-free'");
    expect(bootstrap).toContain("if (!inference.ok || !text.trim())");
    expect(bootstrap).toContain("inference_output_present: true");
    expect(bootstrap).toContain("productionContextInstructions");
    expect(bootstrap).toContain("production_context_verified: true");
    expect(bootstrap).toContain("RENDER_LOCAL_CONTEXT = 8192");
    expect(bootstrap).toContain("status: 'verified'");
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).toContain('audience=atlas-local-ai-bootstrap');
    expect(workflow).toContain('j.inference_verified===true');
    expect(workflow).toContain('j.automatic_api_cost_usd===0');
    expect(workflow).not.toContain('secrets.');
  });

  it('can load the runtime graph with Node strip-types instead of relying on Vitest transforms', () => {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      '--experimental-loader=./apps/atlas-orchestrator/atlas-ts-loader.mjs',
      '--input-type=module',
      '-e',
      "await import('./apps/atlas-orchestrator/src/runtime/container.ts')",
    ], { encoding: 'utf8' });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
