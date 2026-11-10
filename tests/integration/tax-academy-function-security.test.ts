import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(process.cwd() + path, 'utf8');
const persistence = read('/supabase/migrations/20261005090000_tax_academy_certification.sql');
const exams = read('/supabase/migrations/20261005093000_tax_academy_exam_engine.sql');
const combined = `${persistence}\n${exams}`;

const rpcSignatures = [
  'tax_academy_start_attempt(text,text,text)',
  'tax_academy_submit_answer(uuid,text,jsonb)',
  'tax_academy_complete_attempt(uuid)',
  'tax_academy_get_candidate_summary()',
  'tax_academy_record_reviewer_signoff(uuid,text,uuid,text,text)',
  'tax_academy_list_exams()',
  'tax_academy_get_exam_payload(text)',
  'tax_academy_grade_attempt(uuid)'
] as const;

const functionNames = rpcSignatures.map((signature) => signature.slice(0, signature.indexOf('(')));

function latestFunctionDefinition(source: string, name: string): string {
  const marker = `create or replace function public.${name}`;
  const start = source.toLowerCase().lastIndexOf(marker.toLowerCase());
  if (start < 0) return '';
  const next = source.toLowerCase().indexOf('create or replace function public.', start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

describe('ATLAS Tax Academy RPC privilege boundary', () => {
  it('uses an empty search_path on every latest SECURITY DEFINER Academy RPC', () => {
    for (const name of functionNames) {
      const definition = latestFunctionDefinition(combined, name);
      expect(definition, `${name} definition missing`).not.toBe('');
      expect(definition.toLowerCase()).toContain('security definer');
      expect(definition.replace(/\s+/g, '').toLowerCase()).toContain("setsearch_path=''");
    }
  });

  it('revokes inherited execution from PUBLIC and anon before authenticated grants', () => {
    const normalized = combined.replace(/\s+/g, ' ').toLowerCase();
    for (const signature of rpcSignatures) {
      expect(normalized).toContain(
        `revoke execute on function public.${signature} from public, anon, authenticated;`
      );
    }
  });

  it('keeps candidate RPCs explicitly authenticated and reviewer signoff permission-gated', () => {
    const normalized = combined.replace(/\s+/g, ' ').toLowerCase();
    for (const signature of rpcSignatures) {
      expect(normalized).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
    expect(combined).toContain("public.has_identity_permission(v_org,'tax.review')");
  });
});
