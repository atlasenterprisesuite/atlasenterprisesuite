import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
const openaiSource = readFileSync('supabase/functions/atlas-copilot/openai-responses-adapter.mjs', 'utf8');
const localSource = readFileSync('supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs', 'utf8');
const sovereignFreeSource = readFileSync('supabase/functions/atlas-copilot/atlas-sovereign-free-adapter.mjs', 'utf8');
const bedrockSource = readFileSync('supabase/functions/atlas-copilot/amazon-bedrock-responses-adapter.mjs', 'utf8');

describe('ATLAS Unified AI source configuration contract', () => {
  it('uses the verified production OpenAI model as a fail-safe default while preserving server overrides', () => {
    expect(indexSource).toContain("const DEFAULT_OPENAI_MODEL='gpt-6-astra'");
    expect(indexSource).toContain("'ATLAS_OPENAI_MODEL'");
    expect(indexSource).toContain("'ATLAS_OPENAI_MODEL_FAST'");
    expect(indexSource).toContain("'ATLAS_OPENAI_MODEL_BALANCED'");
    expect(indexSource).toContain("'ATLAS_OPENAI_MODEL_DEEP'");
    expect(indexSource).toContain("'ATLAS_OPENAI_ASTRA_MODEL'");
    expect(indexSource).toContain('DEFAULT_OPENAI_MODEL');
  });

  it('constructs all governed provider adapters through the registry', () => {
    expect(indexSource).toContain('createAtlasLocalResponsesAdapter');
    expect(indexSource).toContain('createAtlasSovereignFreeAdapter');
    expect(indexSource).toContain('createOpenAIResponsesAdapter');
    expect(indexSource).toContain('createAmazonBedrockResponsesAdapter');
    expect(indexSource).toContain('createGeminiAdapter');
    expect(indexSource).toContain('createCodexSovereignAdapter');
    expect(indexSource).toContain('createProviderRegistry');
  });

  it('keeps ATLAS Local self-hosted, authenticated and zero-cost eligible without embedded credentials', () => {
    expect(indexSource).toContain("Deno.env.get('ATLAS_LOCAL_AI_URL')");
    expect(indexSource).toContain("Deno.env.get('ATLAS_LOCAL_AI_TOKEN')");
    expect(indexSource).toContain("['atlas-local']");
    expect(localSource).toContain("id:'atlas-local'");
    expect(localSource).toContain("backend:'self-hosted'");
    expect(localSource).toContain('/v1/responses');
    expect(localSource).not.toContain('local-secret');
  });

  it('keeps ATLAS Sovereign Free authenticated, Vault-backed and distinct from physical local inference', () => {
    expect(indexSource).toContain('atlas_get_sovereign_free_runtime_config');
    expect(indexSource).toContain("'atlas-sovereign-free'");
    expect(sovereignFreeSource).toContain("id:'atlas-sovereign-free'");
    expect(sovereignFreeSource).toContain("backend:'render-free-llama'");
    expect(sovereignFreeSource).toContain("authorization:`Bearer ${token}`");
    expect(sovereignFreeSource).not.toContain('render-secret');
  });

  it('keeps OpenAI requests on the Responses API and never embeds a secret', () => {
    expect(openaiSource).toContain("api:'responses'");
    expect(openaiSource).toContain("https://api.openai.com/v1/responses");
    expect(indexSource).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(indexSource).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
    expect(openaiSource).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
  });

  it('keeps Bedrock on AWS Responses endpoints with official Astra model IDs and no embedded credentials', () => {
    expect(indexSource).toContain("const DEFAULT_BEDROCK_REGION='us-west-2'");
    expect(indexSource).toContain("const DEFAULT_BEDROCK_RUNTIME_MODEL='us.openai.gpt-6-astra'");
    expect(indexSource).toContain("const DEFAULT_BEDROCK_MANTLE_MODEL='openai.gpt-6-astra'");
    expect(indexSource).toContain("Deno.env.get('AWS_BEARER_TOKEN_BEDROCK')");
    expect(bedrockSource).toContain('bedrock-runtime.');
    expect(bedrockSource).toContain('bedrock-mantle.');
    expect(bedrockSource).toContain("id:'bedrock'");
    expect(bedrockSource).toContain('provider_verification_required');
    expect(bedrockSource).not.toMatch(/(?:AKIA|ASIA)[A-Z0-9]{16}/);
  });
});
