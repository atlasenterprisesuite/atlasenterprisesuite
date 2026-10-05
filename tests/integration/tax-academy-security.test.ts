import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');

describe('ATLAS Tax Academy candidate/instructor isolation', () => {
  it('does not import instructor answers into candidate-facing runners', () => {
    for (const path of [
      '/apps/web/src/modules/tax/academy/PracticalReturnRunner.tsx',
      '/apps/web/src/modules/tax/academy/ExamRunner.tsx',
      '/apps/web/src/lib/taxAcademyApi.ts'
    ]) {
      const source = read(path);
      expect(source).not.toMatch(/instructor.*answer|answer.*key.*import/i);
      expect(source).not.toContain('answerKeyRef');
      expect(source).not.toContain('correctAnswer');
    }
  });

  it('keeps admin/reviewer surfaces permission gated', () => {
    const admin = read('/apps/web/src/modules/tax/academy/AcademyAdmin.tsx');
    const review = read('/apps/web/src/modules/tax/academy/InstructorReviewQueue.tsx');
    expect(admin).toContain('tax.review');
    expect(review).toContain('tax.review');
    expect(admin).toContain('RequireAcademyReviewer');
    expect(review).toContain('RequireAcademyReviewer');
  });

  it('shows fail-closed production state for training-current content', () => {
    const profile = read('/apps/web/src/modules/tax/academy/CertificationProfile.tsx');
    expect(profile).toContain('Training only — production certification unavailable');
    expect(profile).toContain('criticalFailures');
    expect(profile).toContain('missingRequirements');
  });

  it('never represents ATLAS Academy levels as external credentials', () => {
    const profile = read('/apps/web/src/modules/tax/academy/CertificationProfile.tsx');
    expect(profile).toContain('not an IRS credential');
    expect(profile).toContain('EA Verified');
    expect(profile).toContain('CPA Verified');
  });
});
