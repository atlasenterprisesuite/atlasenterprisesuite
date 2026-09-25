import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const migrationPath = 'supabase/migrations/20260925031000_atlas_chat_core.sql';
const runtimeMigrationPath = 'supabase/migrations/20260925093000_atlas_chat_postgrest_runtime.sql';
const workerPath = 'worker/index.ts';
const wranglerPath = 'wrangler.jsonc';
const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const homePath = 'apps/web/src/modules/connect/ConnectHomePage.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasChatPage.tsx';
const apiPath = 'apps/web/src/modules/connect/chatApi.ts';
const productionContractPath = 'data/ops/global-production-verification.json';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

describe('ATLAS Chat Core', () => {
  it('persists tenant-scoped conversations, ordered messages and fail-closed attachment metadata', () => {
    const sql = read(migrationPath);
    expect(sql).toContain('create table if not exists public.atlas_chat_conversations');
    expect(sql).toContain('create table if not exists public.atlas_chat_participants');
    expect(sql).toContain('create table if not exists public.atlas_chat_messages');
    expect(sql).toContain('create table if not exists public.atlas_chat_message_receipts');
    expect(sql).toContain('create table if not exists public.atlas_chat_message_reactions');
    expect(sql).toContain('create table if not exists public.atlas_chat_attachments');
    expect(sql).toContain('create table if not exists public.atlas_chat_deletion_requests');
    expect(sql).toContain('unique (conversation_id, client_message_id)');
    expect(sql).toContain('unique (conversation_id, sequence)');
    expect(sql).toContain('trace_id uuid not null default gen_random_uuid()');
    expect(sql).toContain('set last_sequence = last_sequence + 1');
    expect(sql).toContain("scan_status = 'clean'");
    expect(sql).toContain('legal_hold boolean not null default false');
    expect(sql).toContain('retention_days integer null');
    expect(sql).toContain('atlas_chat_purge_expired');
    expect(sql).toContain("cron.schedule(");
    expect(sql).toContain("'atlas-chat-retention-daily'");
    expect(sql).toContain('as $$');
    expect(sql).toContain('do $$');
    expect(sql).not.toMatch(/^as \\$$/m);
    expect(sql).toContain("raise exception 'chat_rate_limited'");
  });

  it('enforces RLS, organization membership and participant-scoped access', () => {
    const sql = read(migrationPath);
    expect(sql).toContain('alter table public.atlas_chat_conversations enable row level security');
    expect(sql).toContain('alter table public.atlas_chat_messages enable row level security');
    expect(sql).toContain('public.atlas_chat_can_access(org_id, conversation_id, auth.uid())');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain('revoke insert, update, delete on table');
    expect(sql).toContain('from authenticated');
    expect(sql).toContain('grant execute on function public.atlas_chat_create_conversation');
    expect(sql).toContain('to service_role');
  });

  it('exposes one authenticated PostgREST RPC without consuming another Edge Function slot', () => {
    const runtime = read(runtimeMigrationPath);
    const client = read(apiPath);
    const worker = read(workerPath);
    expect(runtime).toContain('create or replace function public.atlas_chat_api');
    expect(runtime).toContain('v_user uuid := auth.uid()');
    expect(runtime).toContain("om.status = 'active'");
    expect(runtime).toContain("p_api = 'conversations'");
    expect(runtime).toContain("p_api = 'messages'");
    expect(runtime).toContain("p_api = 'export'");
    expect(runtime).toContain("p_api = 'deletion-request'");
    expect(runtime).toContain("p_api = 'deletion-review'");
    expect(runtime).toContain("p_api = 'authorize-realtime'");
    expect(runtime).toContain("p_api = 'publish-authorize'");
    expect(runtime).toContain("'communications.chat.message.created'");
    expect(runtime).toContain("'communications.chat.conversation.read'");
    expect(runtime).toContain("'communications.chat.conversation.exported'");
    expect(runtime).toContain("'communications.chat.deletion.requested'");
    expect(runtime).toContain("'communications.chat.deletion.approved'");
    expect(runtime).toContain("'malware_scan_not_configured'");
    expect(runtime).toContain('grant execute on function public.atlas_chat_api');
    expect(client).toContain("'/rest/v1/rpc/atlas_chat_api'");
    expect(worker).toContain('/rest/v1/rpc/atlas_chat_api');
    expect(client).not.toContain('/functions/v1/atlas-chat');
    expect(worker).not.toContain('/functions/v1/atlas-chat');
  });

  it('uses one-time realtime tickets and a hibernating Durable Object with polling recovery', () => {
    const worker = read(workerPath);
    const wrangler = read(wranglerPath);
    const client = read(apiPath);

    expect(wrangler).toContain('"CHAT_REALTIME_BUS"');
    expect(wrangler).toContain('"AtlasChatRealtimeBus"');
    expect(worker).toContain('export class AtlasChatRealtimeBus');
    expect(worker).toContain("CHAT_BUS_PREFIX = '/_atlas/chat/'");
    expect(worker).toContain("url.pathname === '/ticket'");
    expect(worker).toContain("url.pathname === '/connect'");
    expect(worker).toContain("url.pathname === '/publish'");
    expect(worker).toContain('await this.state.storage.delete(key)');
    expect(worker).toContain("event: 'chat.message'");
    expect(worker).toContain("client_messages_use_http_api");
    expect(client).toContain("fetch('/_atlas/chat/ticket'");
    expect(client).toContain("fetch('/_atlas/chat/publish'");
    expect(client).toContain("handlers.onState?.('polling')");
  });

  it('routes the native workspace through ATLAS Connect with honest states', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(read(routesPath)).toContain('path="/connect/chat"');
    expect(read(homePath)).toContain('to="/connect/chat"');
    const page = read(pagePath);
    expect(page).toContain('ATLAS Chat');
    expect(page).toContain('Polling fallback');
    expect(page).toContain('security gate pending');
    expect(page).toContain('Export JSON');
    expect(page).toContain('Request deletion');
    expect(page).toContain('Messages are persisted before realtime notification is emitted');
  });

  it('adds ATLAS Chat to both fail-closed production route verifiers', () => {
    expect(read(productionContractPath)).toContain('"/connect/chat"');
    expect(read(authorizedVerifierPath)).toContain("'/connect/chat'");
  });
});
