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

  it('lists only active-tenant recordings through Creator authorized read boundary', () => {
    const edge = read('supabase/functions/atlas-creator/index.ts');
    const storage = read('supabase/functions/atlas-creator/_shared/recordings.ts');
    expect(edge).toContain("api === 'recording-list' && req.method === 'GET'");
    expect(edge).toContain("creatorContext(req, 'creator.read')");
    const listed = storage.slice(
      storage.indexOf('export async function listCreatorRecordings('),
      storage.indexOf('export async function createCreatorRecordingDownload(')
    );
    expect(listed).toContain(".eq('organization_id', ctx.orgId)");
    expect(listed).toContain(".order('created_at', { ascending: false })");
    expect(listed).toContain('.limit(50)');
    expect(listed).not.toContain('storage_path');
    expect(listed).not.toContain('createSignedUrl');
    expect(storage).toContain('createSignedUrl(String(row.storage_path), 120)');
  });

  it('requires an explicit tenant context for each private recording endpoint', () => {
    const edge = read('supabase/functions/atlas-creator/index.ts');
    expect(edge).toContain('async function recordingContext(req: Request, permission: CreatorPermission)');
    expect(edge).toContain("creatorError('organization_scope_required', 400)");
    for (const handler of ['Readiness', 'List', 'Upload', 'Download']) {
      const section = edge.slice(edge.indexOf(`async function handleRecording${handler}(`));
      expect(section).toContain("recordingContext(req, 'creator.");
    }
  });

  it('does not send the service-role key to the browser and supports multipart uploads', () => {
    const api = read('apps/web/src/lib/creatorApi.ts');
    expect(api).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(api).toContain("init.body instanceof FormData");
    expect(api).toContain("scopedCreatorRecordingRequest<CreatorRecordingReadiness>('recording-readiness')");
    expect(api).toContain("headers['x-atlas-org-id'] = organization.id");
    expect(api).toContain('await getActiveAtlasOrganization()');
    expect(api).toContain("'recording-upload'");
  });
});
