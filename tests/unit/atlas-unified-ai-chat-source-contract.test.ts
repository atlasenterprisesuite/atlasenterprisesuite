import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
const openaiSource = readFileSync('supabase/functions/atlas-copilot/openai-responses-adapter.mjs', 'utf8');
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
    expect(indexSource).toContain('createOpenAIResponsesAdapter');
    expect(indexSource).toContain('createAmazonBedrockResponsesAdapter');
    expect(indexSource).toContain('createGeminiAdapter');
    expect(indexSource).toContain('createCodexSovereignAdapter');
    expect(indexSource).toContain('createProviderRegistry');
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
