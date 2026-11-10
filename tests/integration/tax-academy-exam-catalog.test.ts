import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');

describe('ATLAS Tax Academy exam catalog', () => {
  const sql = read('/supabase/migrations/20261005093000_tax_academy_exam_engine.sql');
  const api = read('/apps/web/src/lib/taxAcademyApi.ts');
  const library = read('/apps/web/src/modules/tax/academy/ExamLibrary.tsx');

  it('provides an authenticated candidate-safe exam listing RPC', () => {
    expect(sql).toContain('tax_academy_list_exams');
    expect(sql).toContain("'questionCount'");
    expect(sql).toContain("'rulePackStatus'");
    expect(sql).not.toMatch(/jsonb_build_object\([\s\S]{0,500}'expectedValue'/i);
    expect(sql).toContain('revoke execute on function public.tax_academy_list_exams() from public, anon, authenticated;');
    expect(sql).toContain('grant execute on function public.tax_academy_list_exams() to authenticated;');
  });

  it('loads the catalog through the governed API instead of a hardcoded browser list', () => {
    expect(api).toContain('listAcademyExams');
    expect(api).toContain('tax_academy_list_exams');
    expect(library).toContain('listAcademyExams');
    expect(library).not.toMatch(/const\s+exams\s*=\s*\[/i);
  });

  it('renders metadata needed for all seeded module, midterm, final and practical exams', () => {
    for (const label of ['questionCount', 'passingScore', 'rulePackStatus', 'mode']) {
      expect(api).toContain(label);
      expect(library).toContain(label);
    }
  });
});
