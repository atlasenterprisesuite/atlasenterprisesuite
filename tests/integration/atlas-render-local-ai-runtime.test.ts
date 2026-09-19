import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const http = readFileSync('apps/atlas-orchestrator/src/http.ts', 'utf8');
const toolExecutor = readFileSync('packages/atlas-mcp/src/toolExecutor.ts', 'utf8');
const orchestrator = readFileSync('packages/ai-core/src/orchestrator.ts', 'utf8');
const install = readFileSync('scripts/install-render-local-ai.mjs', 'utf8');
const start = readFileSync('scripts/start-atlas-orchestrator.mjs', 'utf8');
const migration = readFileSync('supabase/migrations/20260919034000_atlas_render_free_local_ai.sql', 'utf8');
const bootstrap = readFileSync('supabase/functions/atlas-local-ai-bootstrap/index.ts', 'utf8');
const workflow = readFileSync('.github/workflows/atlas-render-local-ai-verify.yml', 'utf8');

describe('ATLAS Render free local AI runtime contract', () => {
  it('removes Node strip-only parameter properties from the orchestrator import path', () => {
    expect(toolExecutor).not.toContain('constructor(private readonly');
    expect(orchestrator).not.toContain('constructor(private readonly');
    expect(toolExecutor).toContain('this.options = options');
    expect(orchestrator).toContain('this.options = options');
  });

  it('installs local AI artifacts only in Render builds', () => {
    expect(install).toContain("process.env.RENDER !== 'true'");
    expect(install).toContain("LLAMA_VERSION: 'v0.4.1'");
    expect(install).toContain('SmolLM2-135M-Instruct-Q4_K_M.gguf');
    expect(install).toContain('SKIP_CUDA');
    expect(install).toContain('SKIP_ROCM');
    expect(install).toContain('SKIP_VULKAN');
  });

  it('keeps llama on loopback and exposes only the authenticated proxy', () => {
    expect(start).toContain("'--host', '127.0.0.1'");
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

  it('requires a real response inference before Render becomes verified', () => {
    expect(bootstrap).toContain("source !== 'render-free'");
    expect(bootstrap).toContain("text.includes('ATLAS_LOCAL_READY')");
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
