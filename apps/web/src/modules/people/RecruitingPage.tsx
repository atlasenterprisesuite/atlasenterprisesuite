import { useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import type {
  ApplicationStage,
  AssessmentResultRecord,
  RecruitingApplicationRecord,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useRecruitingData, useRecruitingRefresh } from './RecruitingDataProvider';
import { useRecruitingWriteService } from './RecruitingWriteProvider';

const forwardStage: Partial<Record<ApplicationStage, ApplicationStage>> = {
  applied: 'screening',
  screening: 'assessment',
  assessment: 'interview',
  interview: 'offer',
  offer: 'hired',
};

type AssessmentDraft = {
  type: string;
  earned: string;
  possible: string;
  passing: string;
};

const emptyAssessmentDraft: AssessmentDraft = {
  type: '',
  earned: '',
  possible: '',
  passing: '70',
};

export function RecruitingPage() {
  const identity = useAtlasContext();
  const state = useRecruitingData();
  const writeService = useRecruitingWriteService();
  const refresh = useRecruitingRefresh();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [writeState, setWriteState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const readyIdentity = identity.status === 'ready' ? identity : null;
  const canWrite = Boolean(readyIdentity && writeService && hasPermission(readyIdentity.permissions, 'hr.write'));

  const candidateById = useMemo(() => {
    const map = new Map<string, string>();
    if (state.status === 'ready') {
      for (const candidate of state.candidates) map.set(candidate.id, candidate.fullName);
    }
    return map;
  }, [state]);

  const requisitionById = useMemo(() => {
    const map = new Map<string, string>();
    if (state.status === 'ready') {
      for (const requisition of state.requisitions) map.set(requisition.id, requisition.title);
    }
    return map;
  }, [state]);

  const assessmentsByApplication = useMemo(() => {
    const result = new Map<string, AssessmentResultRecord[]>();
    if (state.status !== 'ready') return result;
    for (const assessment of state.assessments) {
      const existing = result.get(assessment.applicationId) ?? [];
      existing.push(assessment);
      result.set(assessment.applicationId, existing);
    }
    return result;
  }, [state]);

  const visibleApplications = useMemo(() => {
    if (state.status !== 'ready') return [];
    const query = search.trim().toLowerCase();
    return state.applications.filter((application) => {
      if (stageFilter !== 'all' && application.stage !== stageFilter) return false;
      if (!query) return true;
      const candidate = candidateById.get(application.candidateId)?.toLowerCase() ?? '';
      const requisition = requisitionById.get(application.requisitionId)?.toLowerCase() ?? '';
      return candidate.includes(query) || requisition.includes(query);
    });
  }, [state, search, stageFilter, candidateById, requisitionById]);

  if (!readyIdentity) return null;

  async function runWrite(action: () => Promise<string>, message: string) {
    setWriteState({ status: 'saving' });
    try {
      await action();
      setWriteState({ status: 'success', message });
      refresh();
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Recruiting write failed',
      });
    }
  }

  function transition(application: RecruitingApplicationRecord, nextStage: ApplicationStage, reason: string | null) {
    if (!writeService) return;
    void runWrite(
      () => writeService.advanceApplicationStage({
        organizationId: readyIdentity.organizationId,
        applicationId: application.id,
        currentStage: application.stage,
        nextStage,
        decisionReason: reason,
      }),
      `Application moved to ${nextStage}`,
    );
  }

  function assessmentDraft(applicationId: string): AssessmentDraft {
    return assessmentDrafts[applicationId] ?? emptyAssessmentDraft;
  }

  function updateAssessmentDraft(applicationId: string, patch: Partial<AssessmentDraft>) {
    setAssessmentDrafts((current) => ({
      ...current,
      [applicationId]: { ...emptyAssessmentDraft, ...(current[applicationId] ?? {}), ...patch },
    }));
  }

  function recordAssessment(applicationId: string) {
    if (!writeService) return;
    const draft = assessmentDraft(applicationId);
    void runWrite(
      () => writeService.recordAssessmentResult({
        organizationId: readyIdentity.organizationId,
        applicationId,
        assessmentType: draft.type,
        earned: Number(draft.earned),
        possible: Number(draft.possible),
        passingPercent: Number(draft.passing),
        evidence: { source: 'manual-authorized-entry' },
      }),
      'Assessment recorded',
    );
  }

  return (
    <main className="atlas-page atlas-module-page people-recruiting-page">
      <p className="atlas-eyebrow">ATLAS People / Recruiting</p>
      <h1>Recruiting</h1>
      <p className="atlas-page__lede">
        Applications and assessment evidence are organization-scoped. Stage changes require explicit HR authorization; ATLAS does not make an automated hiring decision.
      </p>

      {writeState.status === 'success' && (
        <section className="atlas-status-panel" role="status"><strong>{writeState.message}</strong><span>Refreshing recruiting records.</span></section>
      )}
      {writeState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Recruiting write rejected</strong><span>{writeState.message}</span></section>
      )}

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status"><strong>Loading recruiting</strong><span>Reading authorized requisitions, candidates, applications and assessment results.</span></section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status"><strong>Recruiting connection unavailable</strong><span>No configured real Recruiting repository is available.</span></section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Recruiting data unavailable</strong><span>{state.message}</span></section>
      )}

      {state.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Recruiting filters">
            <strong>Search &amp; filter</strong>
            <div className="atlas-filter-grid">
              <label>
                Candidate or requisition
                <input aria-label="Candidate search" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <label>
                Stage
                <select aria-label="Application stage filter" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  <option value="all">All stages</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="assessment">Assessment</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            </div>
          </section>

          <section className="atlas-status-panel" aria-label="Recruiting requisitions">
            <strong>Open requisitions</strong>
            {state.requisitions.filter((item) => item.status === 'open').length === 0
              ? <span>No open requisitions are recorded.</span>
              : state.requisitions.filter((item) => item.status === 'open').map((item) => (
                  <span key={item.id}>{item.title}{item.department ? ` · ${item.department}` : ''}</span>
                ))}
          </section>

          {visibleApplications.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Recruiting empty state"><strong>No applications</strong><span>No authorized applications match the selected filters.</span></section>
          ) : visibleApplications.map((application) => {
            const nextStage = forwardStage[application.stage];
            const decisionReason = reasons[application.id] ?? '';
            const assessments = assessmentsByApplication.get(application.id) ?? [];
            const draft = assessmentDraft(application.id);
            const assessmentReady = Boolean(
              draft.type.trim()
              && draft.earned.trim()
              && draft.possible.trim()
              && draft.passing.trim(),
            );
            return (
              <section className="atlas-status-panel" key={application.id} aria-label={`Application ${application.id}`}>
                <strong>{candidateById.get(application.candidateId) ?? 'Unknown candidate'}</strong>
                <span>{requisitionById.get(application.requisitionId) ?? 'Unknown requisition'} · Stage: {application.stage}</span>
                {application.decisionReason && <span>Decision reason: {application.decisionReason}</span>}
                {assessments.length === 0
                  ? <span>No assessment result is recorded for this application.</span>
                  : assessments.map((assessment) => (
                      <span key={assessment.id}>
                        {assessment.assessmentType.charAt(0).toUpperCase() + assessment.assessmentType.slice(1)} · {assessment.score ?? 'Unscored'}{assessment.maxScore ? ` / ${assessment.maxScore}` : ''}
                      </span>
                    ))}

                {canWrite && !['hired', 'rejected', 'withdrawn'].includes(application.stage) && (
                  <>
                    <div className="atlas-filter-grid" aria-label={`Assessment entry ${application.id}`}>
                      <label>
                        Assessment type
                        <input
                          aria-label={`Assessment type ${application.id}`}
                          value={draft.type}
                          onChange={(event) => updateAssessmentDraft(application.id, { type: event.target.value })}
                          placeholder="english"
                        />
                      </label>
                      <label>
                        Earned
                        <input
                          aria-label={`Assessment earned ${application.id}`}
                          type="number"
                          min="0"
                          value={draft.earned}
                          onChange={(event) => updateAssessmentDraft(application.id, { earned: event.target.value })}
                        />
                      </label>
                      <label>
                        Possible
                        <input
                          aria-label={`Assessment possible ${application.id}`}
                          type="number"
                          min="0.001"
                          value={draft.possible}
                          onChange={(event) => updateAssessmentDraft(application.id, { possible: event.target.value })}
                        />
                      </label>
                      <label>
                        Passing %
                        <input
                          aria-label={`Assessment passing ${application.id}`}
                          type="number"
                          min="0"
                          max="100"
                          value={draft.passing}
                          onChange={(event) => updateAssessmentDraft(application.id, { passing: event.target.value })}
                        />
                      </label>
                    </div>
                    <div className="atlas-action-row">
                      <button
                        type="button"
                        aria-label={`Record assessment ${application.id}`}
                        disabled={writeState.status === 'saving' || !assessmentReady}
                        onClick={() => recordAssessment(application.id)}
                      >Record assessment</button>
                      {nextStage && (
                        <button
                          type="button"
                          aria-label={`Advance ${application.id} to ${nextStage}`}
                          disabled={writeState.status === 'saving'}
                          onClick={() => transition(application, nextStage, null)}
                        >Advance to {nextStage}</button>
                      )}
                      <input
                        aria-label={`Decision reason ${application.id}`}
                        placeholder="Reason for reject/withdraw"
                        value={decisionReason}
                        onChange={(event) => setReasons((current) => ({ ...current, [application.id]: event.target.value }))}
                      />
                      <button
                        type="button"
                        aria-label={`Reject application ${application.id}`}
                        disabled={writeState.status === 'saving' || !decisionReason.trim()}
                        onClick={() => transition(application, 'rejected', decisionReason)}
                      >Reject</button>
                      <button
                        type="button"
                        aria-label={`Withdraw application ${application.id}`}
                        disabled={writeState.status === 'saving' || !decisionReason.trim()}
                        onClick={() => transition(application, 'withdrawn', decisionReason)}
                      >Withdraw</button>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
