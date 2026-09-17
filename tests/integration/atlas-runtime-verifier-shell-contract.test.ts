import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyAtlasCopilotShell } from '../../supabase/functions/_shared/runtime-verifier-shell';

const verifierPath = resolve(process.cwd(), 'supabase/functions/atlas-runtime-verifier/index.ts');

describe('ATLAS runtime verifier shell contract', () => {
  it('accepts the current ATLAS Assistant HTML shell without relying on legacy display copy', () => {
    expect(verifyAtlasCopilotShell({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<title>ATLAS Assistant</title><h2>ATLAS Unified AI Chat</h2>'
    })).toEqual({ ok: true, reason: null });
  });

  it('rejects an unavailable or non-HTML shell', () => {
    expect(verifyAtlasCopilotShell({ status: 503, contentType: 'text/html', body: 'ATLAS Assistant' })).toEqual({
      ok: false,
      reason: 'http_status'
    });
    expect(verifyAtlasCopilotShell({ status: 200, contentType: 'application/json', body: '{}' })).toEqual({
      ok: false,
      reason: 'content_type'
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
