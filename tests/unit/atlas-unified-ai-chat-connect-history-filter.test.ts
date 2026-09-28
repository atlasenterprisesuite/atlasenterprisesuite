import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const pagePath = 'apps/web/src/modules/connect/AtlasChatPage.tsx';
const apiPath = 'apps/web/src/modules/connect/chatApi.ts';
const migrationPath = 'supabase/migrations/20260928214500_atlas_chat_conversation_filters.sql';

describe('ATLAS Unified AI Chat -> Connect history filter gate', () => {
  it('keeps date filtering tenant-scoped, persistent, and server-backed', () => {
    const page = read(pagePath);
    const api = read(apiPath);
    const sql = read(migrationPath);

    expect(page).toContain('Conversation date filters');
    expect(page).toContain('CHAT_FILTER_STORAGE_KEY');
    expect(page).toContain('conversationDateBounds');
    expect(page).toContain('Last activity');
    expect(page).toContain('Created');
    expect(page).toContain('Newest first');
    expect(page).toContain('Oldest first');

    expect(api).toContain("'/rest/v1/rpc/atlas_chat_list_conversations'");
    expect(api).toContain('p_date_field');
    expect(api).toContain('p_from');
    expect(api).toContain('p_to');

    expect(sql).toContain('create or replace function public.atlas_chat_list_conversations');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain("p_date_field not in ('activity','created')");
    expect(sql).toContain("p_sort not in ('newest','oldest')");
    expect(sql).toContain('grant execute on function public.atlas_chat_list_conversations');
  });
});
