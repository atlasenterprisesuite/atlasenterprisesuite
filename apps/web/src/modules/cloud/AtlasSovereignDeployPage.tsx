import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { atlasAuthorizedJson, getActiveAtlasOrganization } from '../../lib/atlasSession';
import {
  evaluateAtlasSovereignDeployReadiness,
  type AtlasSovereignInfraSnapshot,
  type AtlasSovereignReleaseSummary
} from '../../../../../packages/core/src/deploymentControl';
import { CloudSubnav } from './AtlasCloudNextLevel';
import { AtlasDeployDraftComposer } from './AtlasDeployDraftComposer';

type ReleaseRow = AtlasSovereignReleaseSummary & {
  version: string;
  manifest_hash: string | null;
  updated_at: string;
};

type DeploymentRow = {
  id: string;
  status: string;
  environment: string;
  provider_execution_state?: string | null;
  health_state?: string | null;
};

type DeploymentGateRow = {
  id: string;
  gate_key: string;
  status: string;
  required: boolean;
  evidence_ref?: string | null;
};

type DeploymentDetails = {
  deployment: DeploymentRow;
  gates: DeploymentGateRow[];
};

type SovereignDeploySnapshot = {
  organizationId: string;
  infra: AtlasSovereignInfraSnapshot;
  releases: ReleaseRow[];
  fetchedAt: number;
};

const RELEASE_SOURCE = '/functions/v1/atlas-release-control?api=releases';
const INFRA_SOURCE = '/functions/v1/atlas-infra-status';
const REQUIRED = ['supabase', 'cloudflare', 'production'] as const;

function safeError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'sovereign_deploy_evidence_unavailable';
}

export function AtlasSovereignDeployPage() {
  const [snapshot, setSnapshot] = useState<SovereignDeploySnapshot | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [writePanelOpen, setWritePanelOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [assessmentClock, setAssessmentClock] = useState(() => Date.now());
  const [deploymentDetails, setDeploymentDetails] = useState<DeploymentDetails | null>(null);
  const [deploymentMessage, setDeploymentMessage] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const generation = useRef(0);
  const detailsGeneration = useRef(0);

  async function synchronize() {
    const token = ++generation.current;
    // Never display stale, cross-tenant or partial data after refresh failure.
    setSnapshot(null);
    detailsGeneration.current += 1;
    setDeploymentDetails(null);
    setDeploymentMessage('');
    setLoadingDetails(false);
    setLoading(true);
    setError('');
    try {
      const org = await getActiveAtlasOrganization();
      if (!org.id) throw new Error('active_organization_missing');
      const headers = { 'x-atlas-org-id': org.id };
      const [infra, response] = await Promise.all([
        atlasAuthorizedJson<AtlasSovereignInfraSnapshot>(INFRA_SOURCE, { method: 'GET', headers, cache: 'no-store' }),
        atlasAuthorizedJson<{ ok: boolean; releases: ReleaseRow[] }>(RELEASE_SOURCE, { method: 'GET', headers, cache: 'no-store' })
      ]);
      if (!infra || !response?.ok || !Array.isArray(response.releases)) {
        throw new Error('sovereign_deploy_response_invalid');
      }
      if (token !== generation.current) return;
      const allowed = response.releases.filter(item => (
        item && typeof item.id === 'string'
        && typeof item.release_key === 'string'
        && typeof item.status === 'string'
      ));
      const fetchedAt = Date.now();
      setSnapshot({ organizationId: org.id, infra, releases: allowed, fetchedAt });
      setAssessmentClock(fetchedAt);
    } catch (reason) {
      if (token === generation.current) setError(safeError(reason));
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    void synchronize();
    // A green assessment must not remain visible after 15 minutes of inactivity.
    const updateClock = () => setAssessmentClock(Date.now());
    const interval = window.setInterval(updateClock, 30_000);
    window.addEventListener('focus', updateClock);
    return () => {
      generation.current += 1;
      detailsGeneration.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', updateClock);
    };
  }, []);

  const selected = snapshot?.releases.find(item => item.id === selectedId)
    ?? snapshot?.releases.find(item => item.channel === 'production' && item.status === 'promoted')
    ?? snapshot?.releases[0]
    ?? null;

  async function inspectDeploymentGates() {
    if (!selected || !snapshot || loadingDetails) return;
    const token = ++detailsGeneration.current;
    setDeploymentDetails(null);
    setDeploymentMessage('');
    setLoadingDetails(true);
    try {
      const headers = { 'x-atlas-org-id': snapshot.organizationId };
      const response = await atlasAuthorizedJson<{ ok: boolean; deployments: DeploymentRow[] }>(
        `/functions/v1/atlas-release-control?api=deployments&release_id=${encodeURIComponent(selected.id)}`,
        { method: 'GET', headers, cache: 'no-store' }
      );
      if (!response?.ok || !Array.isArray(response.deployments)) {
        throw new Error('deployment_list_invalid');
      }
      const latest = response.deployments[0];
      if (!latest) {
        if (token === detailsGeneration.current) setDeploymentMessage('No deployment attempts recorded for this release.');
        return;
      }
      if (typeof latest.id !== 'string' || !latest.id) throw new Error('deployment_id_invalid');
      const detail = await atlasAuthorizedJson<{ ok: boolean; deployment: DeploymentRow; gates: DeploymentGateRow[] }>(
        `/functions/v1/atlas-release-control?api=deployment&id=${encodeURIComponent(latest.id)}`,
        { method: 'GET', headers, cache: 'no-store' }
      );
      if (!detail?.ok || !detail.deployment || !Array.isArray(detail.gates)) {
        throw new Error('deployment_evidence_invalid');
      }
      if (token === detailsGeneration.current) setDeploymentDetails({
        deployment: detail.deployment,
        gates: detail.gates
      });
    } catch (reason) {
      if (token === detailsGeneration.current) setDeploymentMessage(`Unable to inspect deployment gates: ${safeError(reason)}`);
    } finally {
      if (token === detailsGeneration.current) setLoadingDetails(false);
    }
  }

  const assessment = snapshot
    ? evaluateAtlasSovereignDeployReadiness({
        organizationId: snapshot.organizationId,
        infra: snapshot.infra,
        release: selected,
        now: assessmentClock
      })
    : null;

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page" aria-labelledby="atlas-native-deploy-title">
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Enterprise Suite · Sovereign Cloud</p>
        <h1 id="atlas-native-deploy-title">ATLAS Deploy</h1>
        <p>Native release read/write and deployment evidence console, synchronized with ATLAS Manager and Release Control. Cloudflare is the default edge destination. Vercel is optional. Creation is limited to authenticated release drafts; this screen does not deploy or charge providers.</p>
      </header>

      <div className="atlas-cloud-action-row">
        <button type="button" disabled={loading} onClick={() => void synchronize()}>
          {loading ? 'Synchronizing…' : 'Synchronize evidence'}
        </button>
        <Link to="/release">Manage governed releases</Link>
        <Link to="/cloud/production-verification">Production verification</Link>
      </div>

      {error ? (
        <div className="atlas-cloud-state error" role="alert">
          <strong>ATLAS Deploy blocked</strong>
          <span>{error}. No deployment claims can be made from unavailable backend evidence.</span>
        </div>
      ) : loading ? (
        <div className="atlas-cloud-state" role="status">
          <strong>Reading authenticated control-plane evidence</strong>
          <span>Release Control + ATLAS Manager · organization scoped · read only</span>
        </div>
      ) : snapshot && assessment ? (
        <>
          <section className="atlas-cloud-kpi-grid" aria-label="Sovereign deployment summary">
            <article><span>Decision</span><strong>{assessment.status === 'blocked' ? 'BLOCKED' : 'REVIEW'}</strong></article>
            <article><span>Cloudflare</span><strong>{assessment.providerStates.cloudflare}</strong></article>
            <article><span>Releases visible</span><strong>{snapshot.releases.length}</strong></article>
            <article><span>Production verified</span><strong>No claim</strong></article>
          </section>

          <section className="atlas-cloud-toolbox" aria-labelledby="atlas-deploy-source-title">
            <h2 id="atlas-deploy-source-title">Select existing release</h2>
            <label className="field">
              <span>Organization-scoped release registry</span>
              <select
                value={selected?.id ?? ''}
                disabled={snapshot.releases.length === 0}
                onChange={event => {
                  setSelectedId(event.target.value);
                  detailsGeneration.current += 1;
                  setDeploymentDetails(null);
                  setDeploymentMessage('');
                }}
              >
                {!snapshot.releases.length && <option value="">No releases visible</option>}
                {snapshot.releases.map(item => (
                  <option key={item.id} value={item.id}>{item.release_key} · {item.version} · {item.channel}</option>
                ))}
              </select>
            </label>
            {selected && <div className="atlas-cloud-state">
              <strong>{selected.release_key}</strong>
              <span>Release status: {selected.status} · channel: {selected.channel}</span>
              <span>Source commit: {assessment.targetSha ?? 'not verified as a 40-character SHA'}</span>
              <span>Registry last updated: {selected.updated_at || 'unknown'}</span>
            </div>}
          </section>

          <section className="atlas-cloud-toolbox" aria-labelledby="atlas-deploy-decision-title">
            <h2 id="atlas-deploy-decision-title">Release verification boundary</h2>
            <div className={assessment.status === 'blocked' ? 'atlas-cloud-state error' : 'atlas-cloud-state'}
              role={assessment.status === 'blocked' ? 'alert' : 'status'}>
              <strong>{assessment.status === 'blocked'
                ? 'Blocked — required evidence missing'
                : 'Review required — not production verified'}</strong>
              <span>{assessment.status === 'blocked'
                ? 'P0 fail-closed. Repair evidence at its authoritative source before continuing.'
                : 'Required provider readiness and source metadata can be reviewed. Exact-SHA runtime checks, approvals and deployment execution remain separate.'}</span>
            </div>
            {!!assessment.blockers.length && (
              <ul aria-label="Blocking evidence">
                {assessment.blockers.map(reason => <li key={reason}><code>{reason}</code></li>)}
              </ul>
            )}
            <p className="atlas-cloud-truth-note">Backend snapshot time: {snapshot.infra.evidence?.generated_at || 'unknown'}. No CI result, dashboard status, or provider configuration automatically proves production deployment.</p>
          </section>

          <section className="atlas-cloud-toolbox" aria-labelledby="atlas-deploy-gates-title">
            <h2 id="atlas-deploy-gates-title">Deployment attempts and gates</h2>
            <p>Read existing Release Control evaluations for the selected release. A passing gate does not itself prove the public runtime serves this commit.</p>
            <div className="atlas-cloud-action-row">
              <button type="button" disabled={!selected || loadingDetails} onClick={() => void inspectDeploymentGates()}>
                {loadingDetails ? 'Reading deployment gates…' : 'Inspect deployment gates'}
              </button>
            </div>
            {deploymentMessage && <p role="status">{deploymentMessage}</p>}
            {deploymentDetails && (
              <div className="atlas-cloud-state" role="status">
                <strong>Deployment {deploymentDetails.deployment.id}</strong>
                <span>{deploymentDetails.deployment.environment} · {deploymentDetails.deployment.status}</span>
                <span>Provider execution: {deploymentDetails.deployment.provider_execution_state || 'unknown'} · Health: {deploymentDetails.deployment.health_state || 'unknown'}</span>
                <ul aria-label="Existing deployment gates">
                  {deploymentDetails.gates.map(gate => (
                    <li key={gate.id}><code>{gate.gate_key}</code> · {gate.status} · {gate.required ? 'required' : 'optional'}</li>
                  ))}
                </ul>
                {!deploymentDetails.gates.length && <span>No gate records returned. P0 remains unverified.</span>}
              </div>
            )}
          </section>

          <section className="atlas-cloud-toolbox" aria-label="ATLAS Deploy read and write control">
            <h2>Release records · Read and write</h2>
            <p>Draft creation is governed by the existing releases.create permission, ATLAS organization membership and backend audit. It is not a production deployment.</p>
            <button type="button" aria-expanded={writePanelOpen} aria-controls="atlas-deploy-write-panel"
              onClick={() => setWritePanelOpen(open => !open)}>
              {writePanelOpen ? 'Close controlled writes' : 'Enable controlled writes'}
            </button>
            {writePanelOpen && (
              <div id="atlas-deploy-write-panel">
                <AtlasDeployDraftComposer
                  organizationId={snapshot.organizationId}
                  infra={snapshot.infra}
                  now={assessmentClock}
                  onCreated={id => {
                    setSelectedId(id);
                    void synchronize();
                  }}
                />
              </div>
            )}
          </section>

          <section className="atlas-cloud-toolbox" aria-labelledby="atlas-deploy-providers-title">
            <h2 id="atlas-deploy-providers-title">Native production authorities</h2>
            <div className="atlas-cloud-kpi-grid">
              {REQUIRED.map(provider => (
                <article key={provider}><span>{provider}</span><strong>{assessment.providerStates[provider]}</strong></article>
              ))}
              <article><span>Vercel</span><strong>Optional · unused</strong></article>
            </div>
            <p className="atlas-cloud-truth-note">Source authority: GitHub. Backend / identity authority: Supabase. Production edge: Cloudflare. Coordinating control plane: ATLAS Manager. This console writes no deployment records or secrets.</p>
          </section>

          <div className="atlas-cloud-action-row">
            <Link to="/execution/manager/readiness">Inspect Manager blockers</Link>
            <Link to="/cloud/domains">Check DNS and domains</Link>
            <Link to="/cloud/incidents">Open Incident Center</Link>
          </div>
        </>
      ) : (
        <div className="atlas-cloud-state error" role="alert">No verified ATLAS snapshot is available.</div>
      )}
    </section>
  );
}
