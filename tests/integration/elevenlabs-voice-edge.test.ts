import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as core from '../../supabase/functions/atlas-voice-provider/provider-core.mjs';
import * as elevenlabs from '../../supabase/functions/atlas-voice-provider/elevenlabs.mjs';

function edge(options: { key?: string; permission?: boolean; org?: string; auditOk?: boolean } = {}) {
  let handler: (req: Request) => Promise<Response>;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.includes('/auth/v1/user')) return Response.json({ id: 'user' });
    if (url.includes('/organization_members')) return Response.json([{ org_id: 'org', role: 'owner' }]);
    if (url.includes('/identity_role_permissions')) return Response.json(options.permission === false ? [] : [{ permission_code: '*' }]);
    if (url.includes('/audit_logs')) return Response.json([], { status: options.auditOk === false ? 500 : 201 });
    if (url.includes('/text-to-speech/')) return new Response('audio', { headers: { 'content-type': 'audio/mpeg' } });
    throw new Error(`Unexpected URL: ${url}`);
  });
  const code = transpileModule(readFileSync('supabase/functions/atlas-voice-provider/index.ts', 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, {
    exports: {}, require: (path: string) => path === './provider-core.mjs' ? core : {
      ...elevenlabs, elevenLabsSpeech: (key: string, text: string) => elevenlabs.elevenLabsSpeech(key, text, fetcher),
      elevenLabsAccess: (key: string) => elevenlabs.elevenLabsAccess(key, fetcher)
    },
    Deno: { env: { get: (name: string) => ({ SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ELEVENLABS_API_KEY: options.key ?? 'test-key' }[name]) }, serve: (fn: typeof handler) => { handler = fn; } },
    fetch: fetcher, Response, Request, Headers, URL, crypto, console: { error: vi.fn() }
  });
  return { calls, request: (auth = true, text: unknown = 'Hello') => handler(new Request('https://edge.test?api=speech&provider=elevenlabs', {
    method: 'POST', headers: { ...(auth ? { authorization: 'Bearer user-token' } : {}), 'x-atlas-org-id': options.org ?? 'org' }, body: JSON.stringify({ text })
  })) };
}

describe('ElevenLabs authenticated Edge integration', () => {
  it.each([
    { options: {}, auth: false, status: 401 },
    { options: { permission: false }, auth: true, status: 403 },
    { options: { org: 'other-tenant' }, auth: true, status: 403 },
    { options: { key: '' }, auth: true, status: 503 },
    { options: { auditOk: false }, auth: true, status: 502 }
  ])('blocks synthesis at the authorization/configuration/audit boundary $status', async ({ options, auth, status }) => {
    const app = edge(options);
    expect((await app.request(auth)).status).toBe(status);
    expect(app.calls.some(({ url }) => url.includes('api.elevenlabs.io'))).toBe(false);
  });
  it('rejects malformed text before spending', async () => {
    const app = edge();
    expect((await app.request(true, 123)).status).toBe(400);
    expect(app.calls.some(({ url }) => url.includes('api.elevenlabs.io'))).toBe(false);
  });
  it('audits the authenticated tenant before synthesis and returns disclosed audio', async () => {
    const app = edge();
    const response = await app.request();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-atlas-provider')).toBe('elevenlabs');
    const auditIndex = app.calls.findIndex(({ url }) => url.includes('/audit_logs'));
    const speechIndex = app.calls.findIndex(({ url }) => url.includes('/text-to-speech/'));
    expect(auditIndex).toBeLessThan(speechIndex);
    expect(JSON.parse(String(app.calls[auditIndex].init.body))).toMatchObject({ org_id: 'org', user_id: 'user', action: 'voice.elevenlabs.speech.requested' });
    expect(String(app.calls[auditIndex].init.body)).not.toContain('Hello');
  });
});
