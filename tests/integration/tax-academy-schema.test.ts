import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax Academy persistence security contract', () => {
  const sql=readFileSync(process.cwd()+'/supabase/migrations/20261005090000_tax_academy_certification.sql','utf8');
  const tables=['tax_academy_attempts','tax_academy_answers','tax_academy_practical_results','tax_academy_user_specialties','tax_academy_user_level_history','tax_academy_supervised_returns','tax_academy_reviewer_signoffs','tax_academy_recertifications'];

  it('enables RLS on every Academy table', () => {
    for (const table of tables) expect(sql).toContain('alter table public.'+table+' enable row level security');
  });

  it('keeps tenant identity on governed records', () => {
    for (const table of ['tax_academy_attempts','tax_academy_practical_results','tax_academy_user_level_history','tax_academy_reviewer_signoffs']) {
      expect(sql).toMatch(new RegExp('create table[^;]*'+table+'[\\s\\S]*?org_id uuid','i'));
    }
  });

  it('uses RPC mediated privileged writes and candidate-safe summary', () => {
    expect(sql).toContain('tax_academy_start_attempt');
    expect(sql).toContain('tax_academy_submit_answer');
    expect(sql).toContain('tax_academy_complete_attempt');
    expect(sql).toContain('tax_academy_record_reviewer_signoff');
    expect(sql).toContain('tax_academy_get_candidate_summary');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]*tax_academy_user_level_history\s+to\s+authenticated/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]*tax_academy_reviewer_signoffs\s+to\s+authenticated/i);
  });

  it('does not store candidate-readable answer keys or instructor notes', () => {
    expect(sql).not.toMatch(/answer_key|correct_answer|expected_value|instructor_notes/i);
    expect(sql).toContain('auth.uid()');
  });
});
