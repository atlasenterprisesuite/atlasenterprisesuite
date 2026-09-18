import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyAtlasCopilotShell } from '../../supabase/functions/_shared/runtime-verifier-shell';

const verifierPath = resolve(process.cwd(), 'supabase/functions/atlas-runtime-verifier/index.ts');

describe('ATLAS runtime verifier shell contract', () => {
  it('accepts the ATLAS Assistant HTML shell both directly and after the Supabase text/plain rewrite', () => {
    const body = '<!doctype html><html><head><title>ATLAS Assistant</title></head><body></body></html>';

    expect(verifyAtlasCopilotShell({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body
    })).toEqual({ ok: true, reason: null });

    expect(verifyAtlasCopilotShell({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body
    })).toEqual({ ok: true, reason: null });
  });

  it('fails closed for unavailable, non-HTML, or arbitrary text responses', () => {
    expect(verifyAtlasCopilotShell({ status: 503, contentType: 'text/plain', body: '<!doctype html>' })).toEqual({
      ok: false,
      reason: 'http_status'
    });
    expect(verifyAtlasCopilotShell({ status: 200, contentType: 'application/json', body: '{}' })).toEqual({
      ok: false,
      reason: 'content_type'
    });
    expect(verifyAtlasCopilotShell({ status: 200, contentType: 'text/plain', body: 'not an html shell' })).toEqual({
      ok: false,
      reason: 'body_not_html'
    });
  });

  it('source-controls the production verifier and removes the stale ATLAS IA literal gate', () => {
    expect(existsSync(verifierPath)).toBe(true);
    const source = readFileSync(verifierPath, 'utf8');
    expect(source).toContain("verifyAtlasCopilotShell");
    expect(source).not.toContain("text.includes('ATLAS IA')");
    expect(source).toContain("service!=='atlas-copilot'");
    expect(source).toContain("storage_state!=='configured'");
  });
});
