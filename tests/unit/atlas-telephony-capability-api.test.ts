import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-communication-telephony/index.ts', 'utf8');

describe('ATLAS telephony capability API contract', () => {
  it('protects number discovery with the existing read permission and verified provider path', () => {
    expect(source).toContain("operation === 'number-search'");
    expect(source).toContain("requirePermission(req, ctx, 'communication.telephony.read')");
    expect(source).toContain('probeTelnyxVoice(loaded.config)');
    expect(source).toContain('provider_not_ready');
  });

  it('bounds and validates number-search query inputs', () => {
    expect(source).toContain("url.searchParams.get('country_code')");
    expect(source).toContain("url.searchParams.get('area_code')");
    expect(source).toContain("url.searchParams.get('limit')");
    expect(source).toContain('number_search_country_invalid');
    expect(source).toContain('number_search_area_invalid');
    expect(source).toContain('number_search_limit_invalid');
  });

  it('labels provider candidates as discovery-only and never returns secret values', () => {
    expect(source).toContain("ownership: 'discovered_only'");
    expect(source).toContain('searchTelnyxAvailableNumbers');
    expect(source).toContain('provider_secret_values_returned: false');
    expect(source).not.toContain('apiKey: loaded.config.apiKey');
  });
});
