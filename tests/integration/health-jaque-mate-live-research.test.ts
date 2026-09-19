import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260918235500_health_jaque_mate_live_research.sql', 'utf8');
const edge = readFileSync('supabase/functions/atlas-health-jaque-mate-research/index.ts', 'utf8');

describe('ATLAS Health Jaque Mate live research cycle', () => {
  it('uses real public biomedical sources and preserves a research-only boundary', () => {
    expect(edge).toContain('www.ebi.ac.uk/europepmc/webservices/rest/search');
    expect(edge).toContain('clinicaltrials.gov/api/v2/studies');
    expect(edge).toContain('FIRST_PDATE:[2021-01-01 TO 3000-12-31]');
    expect(edge).toContain("sort: 'LastUpdatePostDate:desc'");
    expect(edge).toContain('RESEARCH ONLY — NO CLINICAL ACTION');
    expect(edge).toContain('POSSIBLE CURE — RESEARCH CANDIDATE');
    expect(edge).toContain("confirmed_cure: false");
    expect(edge).toContain("clinical_action_allowed: false");
  });

  it('requires multi-source human evidence and blocks promotion on contradiction', () => {
    expect(edge).toContain('supportive.length >= 4');
    expect(edge).toContain('human.length >= 3');
    expect(edge).toContain('families.size >= 2');
    expect(edge).toContain('resultBearing.length >= 2');
    expect(edge).toContain('literatureResults.length >= 1');
    expect(edge).toContain('registryResults.length >= 1');
    expect(edge).toContain('contradictions.length === 0');
    expect(edge).toContain('score >= 85');
    expect(edge).toContain("classification = scored.contradictions.length > 0");
    expect(edge).toContain('hasDiseaseContext');
    expect(edge).toContain('diseaseContextMatched');
    expect(edge).toContain("source_evidence_type: 'HYPOTHESIS'");
  });

  it('scores the persisted evidence history instead of resetting evidence every run', () => {
    expect(edge).toContain(".from('health_research_sources')");
    expect(edge).toContain("research_accumulation_read_failed");
    expect(edge).toContain('const accumulated =');
    expect(edge).toContain('candidateScore(accumulated)');
    expect(edge).not.toContain('candidateScore(records);');
  });

  it('creates durable source, run and falsification-assessment records with RLS', () => {
    expect(migration).toContain('create table if not exists public.health_research_runs');
    expect(migration).toContain('create table if not exists public.health_research_sources');
    expect(migration).toContain('create table if not exists public.health_research_assessments');
    expect(migration.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("'atlas.jm.sentinel.read'");
    expect(migration).toContain("'atlas.jm.sentinel.audit'");
  });

  it('keeps the scheduled trigger secret in Vault and calls the research worker every six hours', () => {
    expect(migration).toContain('atlas_jaque_mate_research_trigger_v1');
    expect(migration).toContain('vault.create_secret');
    expect(migration).toContain('validate_jaque_mate_research_trigger');
    expect(migration).toContain("'17 */6 * * *'");
    expect(migration).toContain('x-atlas-research-token');
    expect(edge).toContain("req.headers.get('x-atlas-research-token')");
  });

  it('enriches cure candidates with evidence, limitations and validation status', () => {
    expect(migration).toContain('evidence_snapshot jsonb');
    expect(migration).toContain('limitations jsonb');
    expect(migration).toContain('validation_status text');
    expect(edge).toContain("validation_status: 'HUMAN_REVIEW_PENDING'");
    expect(edge).toContain('evidence_snapshot: evidenceSnapshot');
  });
});
