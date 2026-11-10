import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atlasAuthorizedJson, getActiveAtlasOrganization, getAtlasAccessToken } from '../../apps/web/src/lib/atlasSession';
import { loadTaxLearningProgress, resolveTaxLearningContext, saveTaxLearningAttempt } from '../../apps/web/src/modules/tax/taxLearningRepository';
vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  atlasAuthorizedJson: vi.fn(), getActiveAtlasOrganization: vi.fn(), getAtlasAccessToken: vi.fn()
}));
const context={userId:'user-a',orgId:'org-a'};
const attempt={id:'19ae3c27-b48c-4f0c-8aa4-dfb5076dd560',lessonId:'intake',correct:2,total:2};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAtlasAccessToken).mockReturnValue('test-token');
  vi.mocked(getActiveAtlasOrganization).mockResolvedValue({id:'org-a',role:'owner'});
  vi.mocked(atlasAuthorizedJson).mockImplementation(async path => path==='/auth/v1/user' ? {id:'user-a'} : []);
});
describe('Tax learning repository isolation', () => {
  it('requires a verified authenticated account', async () => {
    vi.mocked(getAtlasAccessToken).mockReturnValue('');
    await expect(resolveTaxLearningContext()).rejects.toThrow();
    expect(atlasAuthorizedJson).not.toHaveBeenCalled();
  });
  it('rejects a user switch before writing', async () => {
    vi.mocked(atlasAuthorizedJson).mockResolvedValue({id:'user-b'});
    await expect(saveTaxLearningAttempt(context,attempt)).rejects.toThrow(/sesión cambió/);
    expect(atlasAuthorizedJson).toHaveBeenCalledTimes(1);
  });
  it('rejects an organization switch before reading', async () => {
    vi.mocked(getActiveAtlasOrganization).mockResolvedValue({id:'org-b',role:'owner'});
    await expect(loadTaxLearningProgress(context)).rejects.toThrow(/sesión cambió/);
    expect(atlasAuthorizedJson).toHaveBeenCalledTimes(1);
  });
  it('validates lesson and scores before any network operation', async () => {
    for(const invalid of [{...attempt,lessonId:'unknown'},{...attempt,correct:3},{...attempt,correct:1.5},{...attempt,total:3}]) {
      await expect(saveTaxLearningAttempt(context,invalid)).rejects.toThrow(/inválido/);
    }
    expect(atlasAuthorizedJson).not.toHaveBeenCalled();
  });
  it('writes only scoped educational scores with a stable duplicate-safe id', async () => {
    await saveTaxLearningAttempt(context,attempt);
    await saveTaxLearningAttempt(context,attempt);
    const writes=vi.mocked(atlasAuthorizedJson).mock.calls.filter(([p]) => p.includes('atlas_tax_learning_attempts'));
    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({
      id:attempt.id,org_id:'org-a',user_id:'user-a',course_version:'2025-v1',lesson_id:'intake',correct_count:2,total_count:2
    });
    expect(writes[0][1]!.headers).toEqual({Prefer:'resolution=ignore-duplicates,return=minimal'});
  });
  it('uses the scoped progress RPC and excludes unknown lessons', async () => {
    vi.mocked(atlasAuthorizedJson).mockImplementation(async path => path==='/auth/v1/user' ? {id:'user-a'} : [
      {lesson_id:'intake',attempts:1,best_percent:100,last_attempt:'2026-10-08'},
      {lesson_id:'unknown',attempts:100,best_percent:100,last_attempt:'2026-10-08'}
    ]);
    expect(await loadTaxLearningProgress(context)).toHaveLength(1);
    const rpc=vi.mocked(atlasAuthorizedJson).mock.calls[1];
    expect(JSON.parse(rpc[1]!.body as string)).toEqual({p_org_id:'org-a',p_course_version:'2025-v1'});
  });
});
