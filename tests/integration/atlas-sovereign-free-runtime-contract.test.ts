import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const relay = readFileSync('tools/sovereign-free/relay.mjs','utf8');
const build = readFileSync('tools/sovereign-free/render-build.sh','utf8');
const start = readFileSync('tools/sovereign-free/render-start.sh','utf8');
const migration = readFileSync('supabase/migrations/20260919034000_atlas_sovereign_free_runtime.sql','utf8');

describe('ATLAS Sovereign Free runtime contract', () => {
  it('uses a tiny instruct GGUF and the official llama installer for constrained free compute', () => {
    expect(build).toContain('https://llama.app/install.sh');
    expect(start).toContain('tensorblock/SmolLM2-135M-Instruct-GGUF:Q4_K_M');
    expect(start).toContain('127.0.0.1');
    expect(start).toContain('--port 8081');
  });

  it('keeps llama private and exposes only the authenticated relay on the Render port', () => {
    expect(start).toContain('127.0.0.1');
    expect(relay).toContain("server.listen(port,'0.0.0.0'");
    expect(relay).toContain('Bearer ');
    expect(relay).toContain("url.pathname!=='/v1/responses'");
    expect(relay).not.toContain('console.log(body)');
  });

  it('stores only the bearer token in Vault and keeps browser roles denied', () => {
    expect(migration).toContain("name='atlas_sovereign_free_runtime_token'");
    expect(migration).toContain('vault.create_secret');
    expect(migration).toContain('vault.update_secret');
    expect(migration).toContain('revoke all on table public.atlas_sovereign_ai_runtimes from anon, authenticated');
    expect(migration).toContain('grant execute on function public.atlas_get_sovereign_free_runtime_config() to service_role');
  });
});
