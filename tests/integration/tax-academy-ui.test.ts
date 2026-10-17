import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');

describe('ATLAS Tax Academy UI contract', () => {
  it('wires Academy navigation and all approved routes', () => {
    const taxRoutes = read('/apps/web/src/modules/tax/TaxRoutes.tsx');
    const academyRoutes = read('/apps/web/src/modules/tax/academy/AcademyRoutes.tsx');
    expect(taxRoutes).toContain('/tax/academy');
    expect(taxRoutes).toContain('Academy');
    expect(taxRoutes).toContain('path="academy/*"');
    for (const route of ['practice','exams','results','certification','admin']) expect(academyRoutes).toContain(`path="${route}`);
  });

  it('surfaces training progress and fail-closed 2026 status', () => {
    const dashboard = read('/apps/web/src/modules/tax/academy/AcademyDashboard.tsx');
    expect(dashboard).toMatch(/Practice &(?:amp;)? Exams/);
    expect(dashboard).toContain('Continue training');
    expect(dashboard).toContain('training_current');
    expect(dashboard).toContain('Training only');
    expect(dashboard).toContain('current_level');
  });

  it('provides searchable/filterable practical cases', () => {
    const library = read('/apps/web/src/modules/tax/academy/PracticeLibrary.tsx');
    expect(library).toContain('ACADEMY_2026_CASES');
    expect(library).toContain('filingStatus');
    expect(library).toContain('level');
    expect(library).toContain('Practice Library');
  });

  it('runs the practical return in the required sequence', () => {
    const runner = read('/apps/web/src/modules/tax/academy/PracticalReturnRunner.tsx');
    for (const label of ['Filing status decision','Source documents','Missing evidence','Form activation','Calculations / workpaper','Diagnostics','Due diligence','Review / e-file readiness']) {
      expect(runner).toContain(label);
    }
  });

  it('keeps exam answers hidden before completion', () => {
    const exam = read('/apps/web/src/modules/tax/academy/ExamRunner.tsx');
    expect(exam).toContain('Answers remain sealed during an active exam');
    expect(exam).not.toContain('correctAnswer');
    expect(exam).not.toContain('answerKeyRef');
  });

  it('shows certification dimensions separately from external credentials', () => {
    const profile = read('/apps/web/src/modules/tax/academy/CertificationProfile.tsx');
    for (const label of ['Knowledge score','Practical score','Critical compliance','Supervised returns','Reviewer signoff','Specialties','External credentials']) {
      expect(profile).toContain(label);
    }
    expect(profile).toContain('Internal ATLAS level');
    expect(profile).toContain('not an IRS credential');
  });
});
