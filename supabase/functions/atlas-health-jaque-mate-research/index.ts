import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FUNCTION_ID = 'atlas-health-jaque-mate-research';
const VERSION = 1;

type SourceRecord = {
  disease_key: string;
  source_name: 'EUROPE_PMC' | 'CLINICALTRIALS_GOV';
  source_identifier: string;
  title: string;
  source_url: string;
  publication_date: string | null;
  source_updated_at: string | null;
  evidence_level: 'human' | 'preclinical' | 'mechanistic' | 'hypothesis';
  study_status: string | null;
  has_results: boolean;
  curative_signal: boolean;
  contradictory_signal: boolean;
  signal_terms: string[];
  summary: string;
  limitations: string[];
  metadata: Record<string, unknown>;
};

const WATCHLIST = [
  { key: 'hiv', label: 'HIV', literature: 'HIV', trial: 'HIV', context: ['hiv', 'human immunodeficiency'] },
  { key: 'cancer', label: 'cancer and leukemia', literature: '(cancer OR leukemia OR lymphoma)', trial: 'Cancer', context: ['cancer', 'leukemia', 'leukaemia', 'lymphoma', 'tumor', 'tumour', 'malignancy'] },
  { key: 't1d', label: 'type 1 diabetes', literature: '"type 1 diabetes"', trial: 'Type 1 Diabetes', context: ['type 1 diabetes', 't1d', 'autoimmune diabetes'] },
  { key: 'fibrosis', label: 'fibrosis', literature: 'fibrosis', trial: 'Fibrosis', context: ['fibrosis', 'fibrotic'] },
  { key: 'alzheimers', label: "Alzheimer's disease", literature: '"Alzheimer disease"', trial: 'Alzheimer Disease', context: ['alzheimer'] },
  { key: 'parkinsons', label: "Parkinson's disease", literature: '"Parkinson disease"', trial: 'Parkinson Disease', context: ['parkinson'] }
] as const;

const CURATIVE_TERMS = [
  'functional cure',
  'sterilizing cure',
  'treatment-free remission',
  'drug-free remission',
  'durable remission',
  'eradication'
] as const;

const CONTRADICTION_TERMS = [
  'rebound',
  'relapse',
  'futility',
  'not durable',
  'failed to',
  'did not achieve',
  'no significant benefit'
] as const;

function admin() {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('server_runtime_not_configured');
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function clean(value: unknown, max = 12000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function dateOnly(value: unknown): string | null {
  const v = clean(value, 40);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function timestamp(value: unknown): string | null {
  const v = clean(value, 80);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function signals(title: string, summary: string, status = '') {
  const text = (title + ' ' + summary).toLowerCase();
  const titleText = title.toLowerCase();
  const curative: string[] = CURATIVE_TERMS.filter((term) => text.includes(term));
  if (/\bcure\b/.test(titleText)) curative.push('cure');
  const contradictory: string[] = CONTRADICTION_TERMS.filter((term) => text.includes(term));
  if (['TERMINATED', 'WITHDRAWN'].includes(status.toUpperCase())) contradictory.push(status.toLowerCase());
  return {
    curative: [...new Set(curative)],
    contradictory: [...new Set(contradictory)]
  };
}

function hasDiseaseContext(
  disease: typeof WATCHLIST[number],
  title: string,
  summary: string
) {
  const titleText = title.toLowerCase();
  const text = (title + ' ' + summary).toLowerCase();
  if (disease.context.some((term) => titleText.includes(term))) return true;

  const signalTerms = [...CURATIVE_TERMS, 'cure'];
  for (const diseaseTerm of disease.context) {
    let diseaseIndex = text.indexOf(diseaseTerm);
    while (diseaseIndex >= 0) {
      for (const signalTerm of signalTerms) {
        let signalIndex = text.indexOf(signalTerm);
        while (signalIndex >= 0) {
          if (Math.abs(diseaseIndex - signalIndex) <= 320) return true;
          signalIndex = text.indexOf(signalTerm, signalIndex + signalTerm.length);
        }
      }
      diseaseIndex = text.indexOf(diseaseTerm, diseaseIndex + diseaseTerm.length);
    }
  }
  return false;
}

function evidenceLevelFromPublication(result: any): SourceRecord['evidence_level'] {
  const types = (result?.pubTypeList?.pubType || []).map((v: unknown) => clean(v, 120).toLowerCase());
  if (types.some((v: string) =>
    v.includes('clinical trial') ||
    v.includes('randomized controlled trial') ||
    v.includes('observational study') ||
    v.includes('meta-analysis')
  )) return 'human';
  const text = (clean(result?.title) + ' ' + clean(result?.abstractText)).toLowerCase();
  if (/\b(mouse|mice|rat|murine|in vitro|cell line|organoid|animal model)\b/.test(text)) return 'preclinical';
  return 'mechanistic';
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ATLAS-Health-Jaque-Mate/1.0' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('upstream_' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function europePmc(disease: typeof WATCHLIST[number]): Promise<SourceRecord[]> {
  const curative = '("functional cure" OR "sterilizing cure" OR "treatment-free remission" OR "drug-free remission" OR "durable remission" OR eradication)';
  const query = '(' + disease.literature + ') AND ' + curative + ' AND FIRST_PDATE:[2021-01-01 TO 3000-12-31] sort_date:y';
  const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?' + new URLSearchParams({
    query,
    format: 'json',
    resultType: 'core',
    pageSize: '8'
  }).toString();
  const body = await fetchJson(url);
  const results = body?.resultList?.result || [];
  return results.flatMap((result: any) => {
    const id = clean(result?.pmid || result?.pmcid || result?.doi || result?.id, 180);
    const title = clean(result?.title, 1200);
    if (!id || !title) return [];
    const summary = clean(result?.abstractText, 12000);
    const s = signals(title, summary);
    const contextMatched = hasDiseaseContext(disease, title, summary);
    const level = evidenceLevelFromPublication(result);
    const pmid = clean(result?.pmid, 80);
    const pmcid = clean(result?.pmcid, 80);
    const doi = clean(result?.doi, 200);
    const sourceUrl = pmid
      ? 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(pmid) + '/'
      : pmcid
        ? 'https://europepmc.org/article/PMC/' + encodeURIComponent(pmcid.replace(/^PMC/i, ''))
        : doi
          ? 'https://doi.org/' + encodeURIComponent(doi)
          : 'https://europepmc.org/article/' + encodeURIComponent(clean(result?.source, 40)) + '/' + encodeURIComponent(id);
    return [{
      disease_key: disease.key,
      source_name: 'EUROPE_PMC' as const,
      source_identifier: id,
      title,
      source_url: sourceUrl,
      publication_date: dateOnly(result?.firstPublicationDate || result?.journalInfo?.printPublicationDate || result?.pubYear),
      source_updated_at: null,
      evidence_level: level,
      study_status: null,
      has_results: level === 'human' && Boolean(summary),
      curative_signal: contextMatched && s.curative.length > 0,
      contradictory_signal: contextMatched && s.contradictory.length > 0,
      signal_terms: [...s.curative, ...s.contradictory],
      summary,
      limitations: [
        'Automated literature screening; full-text methodological appraisal may still be required.',
        'A curative phrase in a publication does not establish a cure.'
      ],
      metadata: {
        pmid: result?.pmid || null,
        pmcid: result?.pmcid || null,
        doi: result?.doi || null,
        authorString: result?.authorString || null,
        journalTitle: result?.journalInfo?.journal?.title || null,
        citedByCount: result?.citedByCount ?? null,
        pubTypes: result?.pubTypeList?.pubType || [],
        diseaseContextMatched: contextMatched
      }
    }];
  });
}

async function clinicalTrials(disease: typeof WATCHLIST[number]): Promise<SourceRecord[]> {
  const url = 'https://clinicaltrials.gov/api/v2/studies?' + new URLSearchParams({
    format: 'json',
    pageSize: '8',
    'query.cond': disease.trial,
    'query.term': '"functional cure" OR "treatment-free remission" OR "drug-free remission" OR "durable remission" OR eradication',
    sort: 'LastUpdatePostDate:desc'
  }).toString();
  const body = await fetchJson(url);
  const studies = body?.studies || [];
  return studies.flatMap((study: any) => {
    const p = study?.protocolSection || {};
    const id = clean(p?.identificationModule?.nctId, 80);
    const title = clean(p?.identificationModule?.briefTitle || p?.identificationModule?.officialTitle, 1200);
    if (!id || !title) return [];
    const summary = clean(p?.descriptionModule?.briefSummary || p?.descriptionModule?.detailedDescription, 12000);
    const status = clean(p?.statusModule?.overallStatus, 80);
    const conditions = Array.isArray(p?.conditionsModule?.conditions)
      ? p.conditionsModule.conditions.map((v: unknown) => clean(v, 200))
      : [];
    const contextMatched = hasDiseaseContext(disease, title, conditions.join(' ') + ' ' + summary);
    const s = signals(title, summary, status);
    const studyType = clean(p?.designModule?.studyType, 80).toUpperCase();
    const phases = Array.isArray(p?.designModule?.phases) ? p.designModule.phases.map((v: unknown) => clean(v, 80)) : [];
    return [{
      disease_key: disease.key,
      source_name: 'CLINICALTRIALS_GOV' as const,
      source_identifier: id,
      title,
      source_url: 'https://clinicaltrials.gov/study/' + encodeURIComponent(id),
      publication_date: dateOnly(p?.statusModule?.studyFirstPostDateStruct?.date || p?.statusModule?.startDateStruct?.date),
      source_updated_at: timestamp(p?.statusModule?.lastUpdatePostDateStruct?.date),
      evidence_level: studyType === 'INTERVENTIONAL' ? 'human' : 'hypothesis',
      study_status: status || null,
      has_results: Boolean(study?.hasResults),
      curative_signal: contextMatched && s.curative.length > 0,
      contradictory_signal: contextMatched && s.contradictory.length > 0,
      signal_terms: [...s.curative, ...s.contradictory],
      summary,
      limitations: [
        'ClinicalTrials.gov is a trial registry; registration or posted results do not by themselves establish efficacy.',
        'Automated screening does not replace protocol, results, safety, or peer-review appraisal.'
      ],
      metadata: {
        nctId: id,
        studyType,
        phases,
        conditions,
        diseaseContextMatched: contextMatched,
        interventions: p?.armsInterventionsModule?.interventions?.map((i: any) => ({
          name: i?.name || null,
          type: i?.type || null
        })) || []
      }
    }];
  });
}

async function authenticate(req: Request) {
  const token = req.headers.get('x-atlas-research-token') || '';
  if (!token) throw new Error('research_trigger_required');
  const { data, error } = await admin().rpc('validate_jaque_mate_research_trigger', { p_token: token });
  if (error || data !== true) throw new Error('invalid_research_trigger');
}

function candidateScore(records: SourceRecord[]) {
  const supportive = records.filter((r) => r.curative_signal && !r.contradictory_signal);
  const contradictions = records.filter((r) => r.contradictory_signal);
  const human = supportive.filter((r) => r.evidence_level === 'human');
  const families = new Set(supportive.map((r) => r.source_name));
  const resultBearing = supportive.filter((r) => r.has_results);
  const literatureResults = resultBearing.filter((r) => r.source_name === 'EUROPE_PMC' && r.evidence_level === 'human');
  const registryResults = resultBearing.filter((r) => r.source_name === 'CLINICALTRIALS_GOV' && r.evidence_level === 'human');
  const score = Math.max(0, Math.min(100,
    supportive.length * 5 +
    human.length * 15 +
    families.size * 15 +
    resultBearing.length * 15 -
    contradictions.length * 20
  ));
  const eligible =
    supportive.length >= 4 &&
    human.length >= 3 &&
    families.size >= 2 &&
    resultBearing.length >= 2 &&
    literatureResults.length >= 1 &&
    registryResults.length >= 1 &&
    contradictions.length === 0 &&
    score >= 85;
  return {
    supportive,
    contradictions,
    human,
    families,
    resultBearing,
    literatureResults,
    registryResults,
    score,
    eligible
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const orgName = clean(body?.organization_name || 'ATLAS', 120);
    const db = admin();
    const { data: org, error: orgError } = await db
      .from('organizations')
      .select('id,name')
      .eq('name', orgName)
      .limit(1)
      .maybeSingle();
    if (orgError || !org) throw new Error('research_org_not_found');

    const { data: run, error: runError } = await db
      .from('health_research_runs')
      .insert({ org_id: org.id, status: 'RUNNING' })
      .select('id')
      .single();
    if (runError || !run) throw new Error('research_run_create_failed');

    let seen = 0;
    let upserted = 0;
    let candidates = 0;
    const assessmentSummary: Array<Record<string, unknown>> = [];

    try {
      for (const disease of WATCHLIST) {
        const [literatureSettled, trialsSettled] = await Promise.allSettled([
          europePmc(disease),
          clinicalTrials(disease)
        ]);
        const records: SourceRecord[] = [];
        if (literatureSettled.status === 'fulfilled') records.push(...literatureSettled.value);
        if (trialsSettled.status === 'fulfilled') records.push(...trialsSettled.value);
        seen += records.length;

        for (const record of records) {
          const { error } = await db.from('health_research_sources').upsert({
            org_id: org.id,
            ...record,
            limitations: record.limitations,
            metadata: record.metadata,
            last_seen_at: new Date().toISOString()
          }, { onConflict: 'org_id,disease_key,source_name,source_identifier' });
          if (!error) upserted += 1;
        }

        const { data: accumulatedRows, error: accumulatedError } = await db
          .from('health_research_sources')
          .select('disease_key,source_name,source_identifier,title,source_url,publication_date,source_updated_at,evidence_level,study_status,has_results,curative_signal,contradictory_signal,signal_terms,summary,limitations,metadata')
          .eq('org_id', org.id)
          .eq('disease_key', disease.key)
          .order('publication_date', { ascending: false, nullsFirst: false })
          .limit(250);
        if (accumulatedError) throw new Error('research_accumulation_read_failed');

        const accumulated = (accumulatedRows || []).map((row: any) => ({
          disease_key: clean(row.disease_key, 120),
          source_name: row.source_name,
          source_identifier: clean(row.source_identifier, 180),
          title: clean(row.title, 1200),
          source_url: clean(row.source_url, 2000),
          publication_date: row.publication_date || null,
          source_updated_at: row.source_updated_at || null,
          evidence_level: row.evidence_level,
          study_status: row.study_status || null,
          has_results: Boolean(row.has_results),
          curative_signal: Boolean(row.curative_signal),
          contradictory_signal: Boolean(row.contradictory_signal),
          signal_terms: Array.isArray(row.signal_terms) ? row.signal_terms.map((v: unknown) => clean(v, 120)) : [],
          summary: clean(row.summary, 12000),
          limitations: Array.isArray(row.limitations) ? row.limitations.map((v: unknown) => clean(v, 1000)) : [],
          metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
        })) as SourceRecord[];

        const scored = candidateScore(accumulated);
        const classification = scored.contradictions.length > 0
          ? 'CONTRADICTED'
          : scored.eligible
            ? 'HUMAN_REVIEW_ELIGIBLE'
            : 'INSUFFICIENT';
        const rationale = scored.eligible
          ? 'Multiple independent human-source signals met the deterministic research gate; independent human review remains mandatory.'
          : scored.contradictions.length > 0
            ? 'Contradictory or failure signals were detected; automatic candidate promotion is blocked.'
            : 'The available real-source evidence does not yet meet the multi-source human-review gate.';

        await db.from('health_research_assessments').upsert({
          run_id: run.id,
          org_id: org.id,
          disease_key: disease.key,
          support_count: scored.supportive.length,
          contradiction_count: scored.contradictions.length,
          human_support_count: scored.human.length,
          source_family_count: scored.families.size,
          result_bearing_count: scored.resultBearing.length,
          candidate_score: scored.score,
          classification,
          rationale
        }, { onConflict: 'run_id,disease_key' });

        if (scored.eligible) {
          const evidenceSnapshot = scored.supportive.slice(0, 12).map((r) => ({
            source: r.source_name,
            id: r.source_identifier,
            title: r.title,
            url: r.source_url,
            evidence_level: r.evidence_level,
            has_results: r.has_results,
            terms: r.signal_terms
          }));
          const { error: candidateError } = await db.from('health_cure_candidates').upsert({
            org_id: org.id,
            candidate_key: 'live-research:' + disease.key,
            disease_key: disease.key,
            title: 'Possible curative pathway — ' + disease.label,
            research_summary:
              'Automated Jaque Mate convergence detected across ' +
              scored.supportive.length + ' supportive real-source records, including ' +
              scored.human.length + ' human-evidence records. This is a research candidate, not a confirmed cure.',
            source_reference: evidenceSnapshot[0]?.url || 'ATLAS_JAQUE_MATE_LIVE_RESEARCH',
            source_evidence_type: 'HYPOTHESIS',
            research_label: 'POSSIBLE CURE — RESEARCH CANDIDATE',
            stage: 'HUMAN_REVIEW_REQUIRED',
            target_curability_level: 'C5',
            clinical_action_allowed: false,
            confirmed_cure: false,
            external_validation_required: true,
            created_by_service: FUNCTION_ID,
            evidence_snapshot: evidenceSnapshot,
            limitations: [
              'Automated source discovery and text screening require independent methodological appraisal.',
              'Registry records and publication language do not establish a cure.',
              'Clinical safety, reproducibility, durability, subgroup applicability and external validation remain unresolved until independently reviewed.'
            ],
            validation_status: 'HUMAN_REVIEW_PENDING',
            last_evaluated_at: new Date().toISOString()
          }, { onConflict: 'org_id,candidate_key' });
          if (!candidateError) candidates += 1;
        }

        assessmentSummary.push({
          disease_key: disease.key,
          sources_discovered_this_run: records.length,
          sources_accumulated: accumulated.length,
          support: scored.supportive.length,
          contradictions: scored.contradictions.length,
          human_support: scored.human.length,
          result_bearing: scored.resultBearing.length,
          literature_results: scored.literatureResults.length,
          registry_results: scored.registryResults.length,
          score: scored.score,
          classification
        });
      }

      await db.from('health_research_runs').update({
        completed_at: new Date().toISOString(),
        status: 'SUCCEEDED',
        sources_seen: seen,
        sources_upserted: upserted,
        candidates_created: candidates
      }).eq('id', run.id);

      return json({
        ok: true,
        version: VERSION,
        run_id: run.id,
        sources_seen: seen,
        sources_upserted: upserted,
        candidates_created: candidates,
        assessments: assessmentSummary,
        boundary: 'RESEARCH ONLY — NO CLINICAL ACTION'
      });
    } catch (error) {
      await db.from('health_research_runs').update({
        completed_at: new Date().toISOString(),
        status: 'FAILED',
        sources_seen: seen,
        sources_upserted: upserted,
        candidates_created: candidates,
        error_code: clean((error as Error)?.message || 'research_cycle_failed', 200)
      }).eq('id', run.id);
      throw error;
    }
  } catch (error) {
    const code = clean((error as Error)?.message || 'research_cycle_failed', 200);
    const status = code.includes('trigger') ? 401 : 500;
    return json({ ok: false, error: code, version: VERSION }, status);
  }
});
