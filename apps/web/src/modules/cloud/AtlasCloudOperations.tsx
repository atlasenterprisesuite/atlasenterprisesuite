import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSubnav } from './AtlasCloudNextLevel';

const OBSERVABILITY_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';
const RELEASE_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control';

type CloudService = {
  module_code: string;
  enabled: boolean;
  launch_status: string;
  data_backend: string;
  updated_at: string;
};

type ResourcePayload = {
  ok: boolean;
  organization_id?: string;
  role?: string;
  projects?: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    updated_at: string;
  }>;
  services?: CloudService[];
};

type ReleaseRow = {
  id: string;
  release_key: string;
  version: string;
  channel: string;
  status: string;
  source_ref: string | null;
  updated_at: string;
  promoted_at: string | null;
};

type IncidentRow = {
  id: string;
  title: string;
  service: string;
  module: string | null;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  error_code: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  resolved_at: string | null;
};

function sessionHeaders() {
  const token = localStorage.getItem('atlas_access_token') || '';
  const orgId = localStorage.getItem('atlas_org_id') || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers['x-atlas-org-id'] = orgId;
  return headers;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: sessionHeaders()
  });
  const body = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(body?.error || `request_failed_${response.status}`));
  return body as T;
}

function LoadingState({ title }: { title: string }) {
  return (
    <div className="atlas-cloud-state" role="status">
      <strong>{title}</strong>
      <span>Reading organization-scoped ATLAS control-plane state.</span>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="atlas-cloud-state error" role="alert">
      <strong>Control-plane data unavailable</strong>
      <span>{error}</span>
    </div>
  );
}

function ControlHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
    </>
  );
}

export function AtlasCloudServiceGraph() {
  const [data, setData] = useState<ResourcePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<ResourcePayload>(`${OBSERVABILITY_URL}?api=cloud-resources`)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'service_graph_unavailable'));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CloudService[]>();
    for (const service of data?.services || []) {
      const backend = service.data_backend || 'unclassified';
      map.set(backend, [...(map.get(backend) || []), service]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const active = (data?.services || []).filter(
    (service) => service.enabled && service.launch_status === 'active'
  ).length;

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Dependency Topology"
        title="Live Service Graph"
        description="Visualize the canonical ATLAS service registry by backend authority without inventing dependency edges that are not represented in source."
      />

      {error ? <ErrorState error={error} /> : !data ? <LoadingState title="Loading service graph" /> : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article><span>Registered services</span><strong>{data.services?.length || 0}</strong></article>
            <article><span>Active services</span><strong>{active}</strong></article>
            <article><span>Backend groups</span><strong>{groups.length}</strong></article>
            <article><span>Projects</span><strong>{data.projects?.length || 0}</strong></article>
          </section>

          <section className="atlas-cloud-service-graph" aria-label="ATLAS service graph">
            <article className="atlas-cloud-graph-root">
              <small>Organization control plane</small>
              <strong>ATLAS Enterprise Suite</strong>
              <span>{data.role || 'organization-scoped identity'}</span>
            </article>

            <div className="atlas-cloud-graph-connector" aria-hidden="true" />

            <div className="atlas-cloud-backend-grid">
              {groups.map(([backend, services]) => (
                <article className="atlas-cloud-backend-node" key={backend}>
                  <header>
                    <span>Backend authority</span>
                    <strong>{backend}</strong>
                  </header>
                  <div className="atlas-cloud-service-chip-grid">
                    {services.map((service) => (
                      <span
                        key={service.module_code}
                        className={service.enabled && service.launch_status === 'active' ? 'active' : 'limited'}
                        title={`${service.module_code} · ${service.launch_status}`}
                      >
                        {service.module_code}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <p className="atlas-cloud-truth-note">
            This graph is generated from <code>atlas_module_registry</code>. Cross-service request edges remain fail-closed until they are represented by trace or explicit dependency evidence.
          </p>
        </>
      )}
    </section>
  );
}

export function AtlasCloudReleaseCenter() {
  const [releases, setReleases] = useState<ReleaseRow[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await getJson<{ ok: boolean; releases: ReleaseRow[] }>(`${RELEASE_URL}?api=releases`);
      setReleases(data.releases || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'releases_unavailable');
    }
  }

  useEffect(() => { void load(); }, []);

  const promoted = (releases || []).filter((item) => item.status === 'promoted').length;
  const production = (releases || []).filter((item) => item.channel === 'production').length;

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Deployment Governance"
        title="Deployment & Release Center"
        description="Release state is read directly from ATLAS Release Control. Source merge, provider deployment and production verification remain separate facts."
      />

      {error ? <ErrorState error={error} /> : releases === null ? <LoadingState title="Loading release control" /> : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article><span>Visible releases</span><strong>{releases.length}</strong></article>
            <article><span>Production channel</span><strong>{production}</strong></article>
            <article><span>Promoted</span><strong>{promoted}</strong></article>
            <article><span>Authority</span><strong>Release Control</strong></article>
          </section>

          <section className="atlas-cloud-release-list">
            {releases.slice(0, 24).map((release) => (
              <article key={release.id}>
                <div>
                  <small>{release.channel}</small>
                  <strong>{release.release_key}</strong>
                  <span>{release.version}</span>
                </div>
                <div>
                  <small>Status</small>
                  <strong className={release.status}>{release.status}</strong>
                </div>
                <div>
                  <small>Source</small>
                  <code>{release.source_ref || 'not recorded'}</code>
                </div>
                <div>
                  <small>Updated</small>
                  <span>{release.updated_at}</span>
                </div>
              </article>
            ))}
            {!releases.length ? (
              <div className="atlas-cloud-state"><strong>No releases visible</strong><span>No organization-scoped release rows are currently available to this identity.</span></div>
            ) : null}
          </section>

          <div className="atlas-cloud-action-row">
            <button type="button" onClick={() => void load()}>Refresh release state</button>
            <Link to="/release">Open full Release Control</Link>
            <Link to="/execution/manager/readiness">Open Manager Readiness</Link>
          </div>
        </>
      )}
    </section>
  );
}

export function AtlasCloudIamPolicy() {
  const [data, setData] = useState<ResourcePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<ResourcePayload>(`${OBSERVABILITY_URL}?api=cloud-resources`)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'identity_boundary_unavailable'));
  }, []);

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Identity Governance"
        title="IAM & Policy Center"
        description="Inspect the current organization boundary and the canonical policy inheritance model. Permission changes remain inside ATLAS Identity and governed approval surfaces."
      />

      {error ? <ErrorState error={error} /> : !data ? <LoadingState title="Loading IAM boundary" /> : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article><span>Current role</span><strong>{data.role || 'unknown'}</strong></article>
            <article><span>Tenant boundary</span><strong>Organization</strong></article>
            <article><span>Browser writes</span><strong>Permission gated</strong></article>
            <article><span>Audit posture</span><strong>Required</strong></article>
          </section>

          <section className="atlas-cloud-policy-grid">
            <article><strong>Organization</strong><p>Top-level tenant and identity boundary.</p></article>
            <article><strong>Projects</strong><p>Project operations are scoped through organization membership and RLS.</p></article>
            <article><strong>Services</strong><p>Module capabilities inherit ATLAS Identity permission checks.</p></article>
            <article><strong>Resources</strong><p>Sensitive mutations remain server-side and audited.</p></article>
          </section>

          <div className="atlas-cloud-action-row">
            <Link to="/identity">Open ATLAS Identity</Link>
            <Link to="/cloud/resources">Inspect organization resources</Link>
          </div>
        </>
      )}
    </section>
  );
}

export function AtlasCloudSecretsConfig() {
  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Protected Configuration"
        title="Secrets & Configuration Center"
        description="Secret material stays in approved provider or Vault-backed stores. Atlas Cloud exposes references and readiness boundaries only, never secret values."
      />

      <section className="atlas-cloud-kpi-grid">
        <article><span>Secret values</span><strong>Never exposed</strong></article>
        <article><span>Source control</span><strong>Prohibited</strong></article>
        <article><span>Runtime access</span><strong>Server-only</strong></article>
        <article><span>Rotation</span><strong>Provider governed</strong></article>
      </section>

      <section className="atlas-cloud-policy-grid">
        <article>
          <strong>Supabase Vault</strong>
          <p>Organization-scoped secret references are resolved server-side where supported.</p>
          <span className="atlas-cloud-boundary-chip">Values hidden</span>
        </article>
        <article>
          <strong>GitHub / CI secrets</strong>
          <p>Deployment credentials remain in GitHub or provider-managed secret stores.</p>
          <span className="atlas-cloud-boundary-chip">Values hidden</span>
        </article>
        <article>
          <strong>Provider credentials</strong>
          <p>OAuth tokens, API keys and recovery credentials are never rendered in Atlas Cloud.</p>
          <span className="atlas-cloud-boundary-chip">Values hidden</span>
        </article>
        <article>
          <strong>Environment configuration</strong>
          <p>Readiness is evaluated through ATLAS Manager rather than inferred from repository files.</p>
          <span className="atlas-cloud-boundary-chip">Evidence required</span>
        </article>
      </section>

      <div className="atlas-cloud-action-row">
        <Link to="/execution/manager/readiness">Open configuration readiness</Link>
        <Link to="/release">Inspect deployment evidence</Link>
      </div>
    </section>
  );
}

export function AtlasCloudFinOps() {
  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Cost Governance"
        title="FinOps & Billing Explorer"
        description="Atlas Cloud now exposes the cost-governance boundary without fabricating provider billing. Live provider spend requires a verified billing feed before dollar totals are displayed."
      />

      <section className="atlas-cloud-kpi-grid">
        <article><span>Live cloud billing feed</span><strong>Not exposed</strong></article>
        <article><span>Paid AI fallback</span><strong>Fail closed</strong></article>
        <article><span>Cost attribution</span><strong>Project / service ready</strong></article>
        <article><span>Forecast totals</span><strong>Evidence gated</strong></article>
      </section>

      <section className="atlas-cloud-finops-flow">
        <article><span>01</span><strong>Provider billing feeds</strong><p>AWS, Google Cloud, Cloudflare, Supabase and other providers must supply verified cost data.</p></article>
        <article><span>02</span><strong>Normalize</strong><p>Map spend to organization, project, service, environment and cost center.</p></article>
        <article><span>03</span><strong>Govern</strong><p>Budgets, anomaly detection and paid-provider policies can then operate on evidence-backed amounts.</p></article>
        <article><span>04</span><strong>Optimize</strong><p>Surface idle resources, cost spikes, unit economics and zero-cost alternatives without inventing savings.</p></article>
      </section>

      <p className="atlas-cloud-truth-note">
        No provider dollar amount is shown here until an authenticated billing authority is connected and verified. This keeps FinOps fail-closed.
      </p>

      <div className="atlas-cloud-action-row">
        <Link to="/finance">Open ATLAS Finance</Link>
        <Link to="/execution/manager/readiness">Open provider readiness</Link>
      </div>
    </section>
  );
}

export function AtlasCloudReliability() {
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await getJson<{ ok: boolean; incidents: IncidentRow[] }>(
        `${OBSERVABILITY_URL}?api=incidents&limit=100`
      );
      setIncidents(data.incidents || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'incidents_unavailable');
    }
  }

  useEffect(() => { void load(); }, []);

  const open = (incidents || []).filter((item) => item.status !== 'resolved');
  const critical = open.filter((item) => item.severity === 'P0' || item.severity === 'P1').length;

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <ControlHeader
        eyebrow="ATLAS Cloud · Reliability"
        title="Incident & Reliability Center"
        description="Read the canonical ATLAS incident authority and correlate reliability state with Observability, Release Control and Manager readiness."
      />

      {error ? <ErrorState error={error} /> : incidents === null ? <LoadingState title="Loading incident authority" /> : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article><span>Open incidents</span><strong>{open.length}</strong></article>
            <article><span>Open P0 / P1</span><strong>{critical}</strong></article>
            <article><span>Total visible</span><strong>{incidents.length}</strong></article>
            <article><span>Authority</span><strong>atlas_incidents</strong></article>
          </section>

          <section className="atlas-cloud-incident-list">
            {incidents.slice(0, 40).map((incident) => (
              <article key={incident.id}>
                <span className={incident.severity}>{incident.severity}</span>
                <div>
                  <strong>{incident.service}</strong>
                  <p>{incident.title}</p>
                </div>
                <div>
                  <small>Status</small>
                  <strong>{incident.status}</strong>
                </div>
                <div>
                  <small>Occurrences</small>
                  <strong>{incident.occurrence_count}</strong>
                </div>
                <div>
                  <small>Last seen</small>
                  <span>{incident.last_seen_at}</span>
                </div>
              </article>
            ))}
            {!incidents.length ? (
              <div className="atlas-cloud-state success"><strong>No incidents visible</strong><span>The current identity has no incident records in scope.</span></div>
            ) : null}
          </section>

          <div className="atlas-cloud-action-row">
            <button type="button" onClick={() => void load()}>Refresh incidents</button>
            <Link to="/cloud/observability">Open telemetry</Link>
            <Link to="/release">Open Release Control</Link>
          </div>
        </>
      )}
    </section>
  );
}
