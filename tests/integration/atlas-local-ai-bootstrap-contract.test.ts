import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260919022000_atlas_local_ai_runtime_bootstrap.sql','utf8');
const offlineState = readFileSync('supabase/migrations/20260919033500_atlas_local_ai_offline_state.sql','utf8');
const bootstrap = readFileSync('supabase/functions/atlas-local-ai-bootstrap/index.ts','utf8');
const workflow = readFileSync('.github/workflows/atlas-local-ai-bootstrap.yml','utf8');
const installer = readFileSync('tools/local-agent/install-local-ai-linux.sh','utf8');
const copilot = readFileSync('supabase/functions/atlas-copilot/index.ts','utf8');
const adapter = readFileSync('supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs','utf8');

describe('ATLAS Local AI live bootstrap contract', () => {
  it('keeps runtime and Access credentials in ATLAS Vault only', () => {
    expect(migration).toContain("name='atlas_local_ai_runtime_token'");
    expect(migration).toContain("name='atlas_local_ai_access_client_secret'");
    expect(migration).toContain('vault.create_secret');
    expect(migration).toContain('vault.update_secret');
    expect(migration).toContain('revoke all on function public.atlas_get_local_ai_runtime_config() from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.atlas_get_local_ai_runtime_config() to service_role');
  });

  it('authorizes bootstrap only from the canonical main workflow via GitHub OIDC', () => {
    expect(bootstrap).toContain("const AUDIENCE = 'atlas-local-ai-bootstrap'");
    expect(bootstrap).toContain("payload.ref !== 'refs/heads/main'");
    expect(bootstrap).toContain("'atlas-local-ai-bootstrap.yml'");
    expect(bootstrap).toContain("'atlas-render-local-ai-verify.yml'");
    expect(bootstrap).toContain(
      "GITHUB_SCOPE.allowsRepository(payload.repository, payload.repository_owner)"
    );
    expect(bootstrap).not.toContain('GITHUB_TOKEN');
  });

  it('provisions a protected Cloudflare Tunnel instead of opening an inbound model port', () => {
    expect(bootstrap).toContain("const HOSTNAME = 'local-ai.atlasenterprisesuite.com'");
    expect(bootstrap).toContain("service: 'http://127.0.0.1:8080'");
    expect(bootstrap).toContain('cfargotunnel.com');
    expect(bootstrap).toContain("decision: 'non_identity'");
    expect(bootstrap).toContain('service_token');
    expect(installer).toContain('cloudflared tunnel --no-autoupdate run --token-file');
    expect(installer).not.toContain('cloudflared tunnel run --token ');
  });

  it('pins the reference local stack and remains loopback-only', () => {
    expect(installer).toContain('v0.4.1');
    expect(installer).toContain('ggml-org/Qwen3.5-0.8B-GGUF:Q4_0');
    expect(installer).toContain('--host 127.0.0.1');
    expect(installer).toContain('LLAMA_API_KEY=');
    expect(installer).not.toContain('--api-key');
    expect(installer).not.toContain('--host 0.0.0.0');
  });

  it('never treats installation alone as production verification', () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('runs-on: self-hosted');
    expect(workflow).toContain('audience=atlas-local-ai-bootstrap');
    expect(workflow).toContain('::add-mask::');
    expect(workflow).toContain('install-local-ai-linux.sh');
    expect(workflow).toContain('?api=verify');
    expect(workflow).toContain("j.inference_verified!==true");
    expect(workflow).not.toContain('secrets.');
    expect(bootstrap).toContain("instructions: 'Return a short readiness response. This request exists only to prove real local generation.'");
    expect(bootstrap).toContain("if (!inference.ok || !text.trim())");
    expect(bootstrap).toContain("inference_output_present: true");
    expect(bootstrap).toContain("status: 'verified'");
  });

  it('lets atlas-copilot resolve the runtime from Vault and pass Cloudflare Access headers', () => {
    expect(copilot).toContain('atlas_get_local_ai_runtime_config');
    expect(copilot).toContain('ATLAS_LOCAL_AI_ACCESS_CLIENT_ID');
    expect(copilot).toContain('ATLAS_LOCAL_AI_ACCESS_CLIENT_SECRET');
    expect(adapter).toContain("'CF-Access-Client-Id'");
    expect(adapter).toContain("'CF-Access-Client-Secret'");
    expect(adapter).toContain("id:'atlas-local'");
  });

  it('records an explicit offline host state without inventing production readiness', () => {
    expect(offlineState).toContain("'offline'");
    expect(offlineState).toContain("'host_offline'");
    expect(offlineState).toContain("'waiting_for_self_hosted_runner'");
    expect(offlineState).toContain("'automatic_api_cost_usd', 0");
    expect(copilot).toContain("state:clean(stored?.status)||'not_configured'");
    expect(copilot).toContain("host_required:localAi.state!=='verified'");
    expect(bootstrap).toContain("runtime_state: runtimeState");
    expect(bootstrap).toContain("host_required: runtimeState !== 'verified'");
    expect(bootstrap).toContain('paid_fallback_enabled: false');
  });

  it('keeps the zero-cost fail-closed boundary explicit', () => {
    expect(copilot).toContain("return ids.length?ids:['atlas-local']");
    expect(bootstrap).toContain('automatic_api_cost_usd: 0');
    expect(bootstrap).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
    expect(workflow).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
  });
});
