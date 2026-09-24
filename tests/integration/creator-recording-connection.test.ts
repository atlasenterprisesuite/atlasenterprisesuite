import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('ATLAS Creator teleprompter recording connection', () => {
  it('creates a private organization-scoped recording bucket and metadata table', () => {
    const sql = read('supabase/migrations/20260918_creator_teleprompter_recordings.sql');
    expect(sql).toContain('create table if not exists public.creator_recordings');
    expect(sql).toContain("'atlas-creator-recordings'");
    expect(sql).toContain('false');
    expect(sql).toContain('organization_members');
    expect(sql).not.toContain('grant insert on public.creator_recordings to authenticated');
  });

  it('mediates uploads through the existing authorized Creator boundary', () => {
    const edge = read('supabase/functions/atlas-creator/index.ts');
    const storage = read('supabase/functions/atlas-creator/_shared/recordings.ts');
    expect(edge).toContain("creatorContext(req, 'creator.write')");
    expect(edge).toContain("api === 'recording-upload'");
    expect(edge).toContain("api === 'recording-download'");
    expect(storage).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(storage).toContain('.createSignedUrl(');
    expect(storage).toContain('.eq(\'organization_id\', ctx.orgId)');
  });

  it('does not send the service-role key to the browser and supports multipart uploads', () => {
    const api = read('apps/web/src/lib/creatorApi.ts');
    expect(api).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(api).toContain("init.body instanceof FormData");
    expect(api).toContain("creatorRequest<CreatorRecordingReadiness>('recording-readiness')");
    expect(api).toContain("'recording-upload'");
  });
});
