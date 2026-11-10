import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');
const source = `${read('/supabase/migrations/20261005090000_tax_academy_certification.sql')}\n${read('/supabase/migrations/20261005093000_tax_academy_exam_engine.sql')}`;

const candidateFunctions = [
  'tax_academy_start_attempt',
  'tax_academy_submit_answer',
  'tax_academy_complete_attempt',
  'tax_academy_get_candidate_summary',
  'tax_academy_list_exams',
  'tax_academy_get_exam_payload',
  'tax_academy_grade_attempt'
] as const;

function latestDefinition(name: string): string {
  const marker = `create or replace function public.${name}`;
  const lower = source.toLowerCase();
  const start = lower.lastIndexOf(marker.toLowerCase());
  if (start < 0) return '';
  const next = lower.indexOf('create or replace function public.', start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

describe('ATLAS Tax Academy candidate SECURITY DEFINER authorization', () => {
  it('requires authenticated identity, active organization and tax.read inside every candidate RPC', () => {
    for (const name of candidateFunctions) {
      const definition = latestDefinition(name);
      expect(definition, `${name} definition missing`).not.toBe('');
      expect(definition).toContain('auth.uid()');
      expect(definition).toContain('v_org');
      expect(definition).toContain("public.has_identity_permission(v_org,'tax.read')");
    }
  });

  it('only accepts answer mutations while the owned attempt is in progress', () => {
    const definition = latestDefinition('tax_academy_submit_answer');
    expect(definition).toContain("status='in_progress'");
  });

  it('keeps grading scoped to the authenticated candidate and their active organization', () => {
    const definition = latestDefinition('tax_academy_grade_attempt');
    expect(definition).toContain('a.org_id = v_org');
    expect(definition).toContain('a.user_id = auth.uid()');
    expect(definition).toContain("v_attempt.status <> 'submitted'");
  });
});
