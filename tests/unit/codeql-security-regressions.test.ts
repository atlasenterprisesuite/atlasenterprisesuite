import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const taxMonitor = readFileSync('packages/tax-irs-monitor/src/monitor.mjs', 'utf8');
const hubspotWatch = readFileSync('scripts/verify-hubspot-platform.mjs', 'utf8');
const openAiDomain = readFileSync('supabase/functions/atlas-execution/openai-domain.ts', 'utf8');
const advisoryWorkflow = readFileSync('.github/workflows/advisory-office-ci.yml', 'utf8');
const signInterpret = readFileSync('supabase/functions/atlas-sign-interpret/index.ts', 'utf8');

describe('CodeQL security regression contracts', () => {
  it('handles whitespace before script and style end-tag closers', () => {
    expect(taxMonitor).toContain('<\\/script\\b[^>]*>');
    expect(taxMonitor).toContain('<\\/style\\b[^>]*>');
    expect(hubspotWatch).toContain('<\\/script\\b[^>]*>');
    expect(hubspotWatch).toContain('<\\/style\\b[^>]*>');
  });

  it('decodes only one known HTML entity layer per pass', () => {
    expect(hubspotWatch).toContain('decodeKnownHtmlEntity');
    expect(hubspotWatch).toContain('/&(amp|quot|#39|nbsp);/gi');
    expect(hubspotWatch).not.toContain(".replace(/&amp;/g, '&')");
  });

  it('matches DNS providers only on exact hosts or dot-delimited suffixes', () => {
    expect(openAiDomain).toContain("hostname === 'cloudflare.com' || hostname.endsWith('.cloudflare.com')");
    expect(openAiDomain).toContain("hostname === 'domaincontrol.com' || hostname.endsWith('.domaincontrol.com')");
    expect(openAiDomain).toContain("hostname === 'registrar-servers.com' || hostname.endsWith('.registrar-servers.com')");
    expect(openAiDomain).not.toContain("joined.includes('cloudflare.com')");
  });

  it('limits the Advisory workflow token permissions', () => {
    expect(advisoryWorkflow).toContain('permissions:\n  contents: read');
  });

  it('keeps provider exceptions out of the sign-interpret HTTP response', () => {
    expect(signInterpret).toContain("catch { return json({ ok:false, error:'provider_unreachable' }");
    expect(signInterpret).not.toContain('message:String(error?.message || error)');
  });
});
