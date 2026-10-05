import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax Academy browser API contract', () => {
  const source = readFileSync(process.cwd() + '/apps/web/src/lib/taxAcademyApi.ts', 'utf8');

  it('uses authenticated ATLAS fetch and active organization context', () => {
    expect(source).toContain('authorizedAtlasFetch');
    expect(source).toContain('getActiveAtlasOrganization');
    expect(source).toContain("'/rest/v1/rpc/' + name");
    for (const rpcName of [
      'tax_academy_start_attempt',
      'tax_academy_submit_answer',
      'tax_academy_complete_attempt',
      'tax_academy_get_candidate_summary'
    ]) expect(source).toContain(rpcName);
  });

  it('keeps candidate response contracts free of hidden grading fields', () => {
    const candidateSurface = source.split('// INSTRUCTOR-ONLY SURFACE')[0];
    expect(candidateSurface).not.toMatch(/answerKey|correctAnswer|expectedValue|instructorNotes/);
  });

  it('uses separate instructor/reviewer functions instead of an include-answers candidate endpoint', () => {
    expect(source).toContain('listAcademyReviewQueue');
    expect(source).toContain('recordAcademyReviewerSignoff');
    expect(source).not.toContain('includeAnswers');
  });
});
