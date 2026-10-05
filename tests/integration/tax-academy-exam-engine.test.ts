import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');

describe('ATLAS Tax Academy protected exam engine', () => {
  const sql = read('/supabase/migrations/20261005093000_tax_academy_exam_engine.sql');
  const api = read('/apps/web/src/lib/taxAcademyApi.ts');
  const runner = read('/apps/web/src/modules/tax/academy/ExamRunner.tsx');

  it('stores exam metadata and protected grading material behind RLS', () => {
    expect(sql).toContain('create table if not exists public.tax_academy_exams');
    expect(sql).toContain('create table if not exists public.tax_academy_questions');
    expect(sql).toContain('expected_value jsonb');
    expect(sql).toContain('critical_failure_code text');
    expect(sql).toContain('alter table public.tax_academy_questions enable row level security');
    expect(sql).toContain('revoke all on public.tax_academy_questions from anon, authenticated');
    expect(sql).not.toMatch(/grant\s+select\s+on\s+public\.tax_academy_questions\s+to\s+authenticated/i);
  });

  it('exposes a candidate-safe payload RPC and a server-side grader', () => {
    expect(sql).toContain('tax_academy_get_exam_payload');
    expect(sql).toContain('tax_academy_grade_attempt');
    expect(sql).toContain("'questionId'");
    expect(sql).toContain("'prompt'");
    expect(sql).toContain("'options'");
    expect(sql).not.toMatch(/'expectedValue'\s*,/i);
    expect(sql).not.toMatch(/'correctAnswer'\s*,/i);
  });

  it('loads exam questions through the safe RPC instead of hardcoded browser answer material', () => {
    expect(api).toContain('getAcademyExam');
    expect(api).toContain('tax_academy_get_exam_payload');
    const candidateSurface = api.split('// INSTRUCTOR-ONLY SURFACE')[0];
    expect(candidateSurface).not.toMatch(/expectedValue|correctAnswer|answerKey/i);
    expect(runner).toContain('getAcademyExam');
    expect(runner).not.toContain('correctAnswer');
    expect(runner).not.toContain('expectedValue');
  });

  it('returns only post-submission score/pass/critical-failure state to the candidate', () => {
    expect(api).toContain('score: number | null');
    expect(api).toContain('passed: boolean | null');
    expect(api).toContain('criticalFailures: string[]');
    expect(sql).toContain('tax_academy_complete_attempt');
    expect(sql).toContain('weighted_score');
  });
});
