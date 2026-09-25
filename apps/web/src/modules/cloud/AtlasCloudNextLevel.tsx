import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const CONTROL_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';

const CLOUD_API_ALIASES: Record<string, string> = {
  openapi: 'cloud-openapi',
  resources: 'cloud-resources',
  project: 'cloud-project',
  'project-create': 'cloud-project-create',
  observability: 'cloud-observability'
};

type CloudProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  updated_at: string;
};

type CloudService = {
  module_code: string;
  enabled: boolean;
  launch_status: string;
  data_backend: string;
  updated_at: string;
};

type ResourcePayload = {
  ok: boolean;
  projects: CloudProject[];
  services: CloudService[];
  truth?: {
    project_authority: string;
    service_authority: string;
    duplicated_registry_created: boolean;
  };
};

type ObservabilityPayload = {
  ok: boolean;
  observability?: {
    posture?: string;
    incidents?: Record<string, number>;
    telemetry?: {
      window_minutes?: number;
      traces?: number;
      trace_errors?: number;
      metrics?: number;
    };
    latest_verifications?: Record<string, { status?: string; created_at?: string }>;
    checkedAt?: string;
  };
  error?: string;
};

type OpenApiPayload = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, { summary?: string }>>;
};

function sessionHeaders(json = false) {
  const token = localStorage.getItem('atlas_access_token') || '';
  const orgId = localStorage.getItem('atlas_org_id') || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers['x-atlas-org-id'] = orgId;
  if (json) headers['content-type'] = 'application/json';
  return headers;
}

async function cloudRequest<T>(
  api: string,
  init: RequestInit = {},
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(CONTROL_URL);
  url.searchParams.set('api', CLOUD_API_ALIASES[api] || api);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { ...sessionHeaders(Boolean(init.body)), ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    throw new Error(String(body?.error || `request_failed_${response.status}`));
  }
  return body as T;
}

function CloudSubnav() {
  return (
    <nav className="atlas-cloud-subnav" aria-label="Atlas Cloud control surfaces">
      <Link to="/cloud">Overview</Link>
      <Link to="/cloud/api-explorer">API Explorer</Link>
      <Link to="/cloud/observability">Observability</Link>
      <Link to="/cloud/resources">Resource Manager</Link>
      <Link to="/cloud/docs">Documentation</Link>
    </nav>
  );
}

function StatePanel({
  title,
  body,
  tone = 'neutral'
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'error' | 'success';
}) {
  return (
    <div className={`atlas-cloud-state ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function AtlasCloudApiExplorer() {
  const [spec, setSpec] = useState<OpenApiPayload | null>(null);
  const [result, setResult] = useState('');
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    cloudRequest<OpenApiPayload>('openapi')
      .then(setSpec)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'openapi_unavailable'));
  }, []);

  const operations = useMemo(() => {
    if (!spec?.paths) return [];
    return Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        summary: operation.summary || ''
      }))
    );
  }, [spec]);

  async function runRead(api: 'resources' | 'observability') {
    setRunning(api);
    setError('');
    try {
      const response = await cloudRequest<unknown>(api);
      setResult(JSON.stringify(response, null, 2));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'request_failed');
    } finally {
      setRunning('');
    }
  }

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Developer Control</p>
        <h1>API Explorer</h1>
        <p>
          Discover the governed ATLAS Cloud control API from its live OpenAPI contract. Interactive
          execution is limited to approved read-only operations and uses the current ATLAS identity.
        </p>
      </header>

      {error ? (
        <StatePanel title="API request blocked" body={error} tone="error" />
      ) : !spec ? (
        <StatePanel title="Loading API contract" body="Reading the authenticated OpenAPI surface." />
      ) : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article><span>Specification</span><strong>{spec.openapi || '—'}</strong></article>
            <article><span>API version</span><strong>{spec.info?.version || '—'}</strong></article>
            <article><span>Operations</span><strong>{operations.length}</strong></article>
            <article><span>Authentication</span><strong>ATLAS Identity</strong></article>
          </section>

          <section className="atlas-cloud-operation-list" aria-label="OpenAPI operations">
            {operations.map((operation) => (
              <article key={`${operation.method}-${operation.path}`}>
                <span className="atlas-cloud-method">{operation.method}</span>
                <code>{operation.path}</code>
                <p>{operation.summary}</p>
              </article>
            ))}
          </section>

          <section className="atlas-cloud-toolbox">
            <div>
              <p className="eyebrow">Safe execution</p>
              <h2>Try approved read operations</h2>
              <p>
                Tokens are sent in request headers only. They are never printed into the response panel.
              </p>
            </div>
            <div className="atlas-cloud-action-row">
              <button type="button" onClick={() => runRead('resources')} disabled={Boolean(running)}>
                {running === 'resources' ? 'Running…' : 'Run resource inventory'}
              </button>
              <button type="button" onClick={() => runRead('observability')} disabled={Boolean(running)}>
                {running === 'observability' ? 'Running…' : 'Run observability summary'}
              </button>
            </div>
            <pre className="atlas-cloud-json-result">{result || 'No request executed yet.'}</pre>
          </section>
        </>
      )}
    </section>
  );
}

export function AtlasCloudObservability() {
  const [data, setData] = useState<ObservabilityPayload | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setData(await cloudRequest<ObservabilityPayload>('observability'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'observability_unavailable');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = data?.observability;
  const incidents = summary?.incidents || {};
  const critical = Number(incidents.P0 || 0) + Number(incidents.P1 || 0);
  const lower = Number(incidents.P2 || 0) + Number(incidents.P3 || 0);

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Native Telemetry</p>
        <h1>Observability</h1>
        <p>
          Live operational posture backed by the existing ATLAS incidents, trace spans, runtime
          verification evidence and operational metrics. No duplicate log store is introduced.
        </p>
      </header>

      {error ? (
        <StatePanel title="Observability unavailable" body={error} tone="error" />
      ) : !summary ? (
        <StatePanel title="Loading telemetry" body="Reading the organization-scoped ATLAS observability summary." />
      ) : (
        <>
          <section className="atlas-cloud-kpi-grid">
            <article>
              <span>Posture</span>
              <strong>{summary.posture || 'unknown'}</strong>
            </article>
            <article>
              <span>Open P0 / P1</span>
              <strong>{critical}</strong>
            </article>
            <article>
              <span>Open P2 / P3</span>
              <strong>{lower}</strong>
            </article>
            <article>
              <span>Trace errors · {summary.telemetry?.window_minutes || 30}m</span>
              <strong>{summary.telemetry?.trace_errors ?? '—'}</strong>
            </article>
          </section>

          <section className="atlas-cloud-observability-grid">
            <article>
              <h2>Telemetry window</h2>
              <dl>
                <div><dt>Traces</dt><dd>{summary.telemetry?.traces ?? '—'}</dd></div>
                <div><dt>Metrics</dt><dd>{summary.telemetry?.metrics ?? '—'}</dd></div>
                <div><dt>Trace errors</dt><dd>{summary.telemetry?.trace_errors ?? '—'}</dd></div>
              </dl>
            </article>
            <article>
              <h2>Verification evidence</h2>
              <div className="atlas-cloud-verification-list">
                {Object.entries(summary.latest_verifications || {}).slice(0, 12).map(([service, item]) => (
                  <div key={service}>
                    <strong>{service}</strong>
                    <span>{item.status || 'unknown'}</span>
                  </div>
                ))}
                {Object.keys(summary.latest_verifications || {}).length === 0 ? (
                  <p>No verification evidence is currently visible to this identity.</p>
                ) : null}
              </div>
            </article>
          </section>

          <div className="atlas-cloud-action-row">
            <button type="button" onClick={() => void load()}>Refresh telemetry</button>
            <Link to="/execution/manager/readiness">Open Manager Readiness</Link>
            <Link to="/release">Open Release Control</Link>
          </div>
        </>
      )}
    </section>
  );
}

export function AtlasCloudResourceManager() {
  const [data, setData] = useState<ResourcePayload | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', priority: 'medium' });

  async function load() {
    setError('');
    try {
      setData(await cloudRequest<ResourcePayload>('resources'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'resource_inventory_unavailable');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      await cloudRequest('project-create', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ name: '', description: '', priority: 'medium' });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'project_create_failed');
    } finally {
      setCreating(false);
    }
  }

  async function openProject(id: string) {
    setError('');
    try {
      setSelected(await cloudRequest<Record<string, unknown>>('project', {}, { id }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'project_unavailable');
    }
  }

  const servicesByBackend = useMemo(() => {
    const groups = new Map<string, CloudService[]>();
    for (const service of data?.services || []) {
      const key = service.data_backend || 'unclassified';
      groups.set(key, [...(groups.get(key) || []), service]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Resource Hierarchy</p>
        <h1>Resource Manager</h1>
        <p>
          Organization-scoped projects and services using the existing project tables and canonical
          ATLAS module registry. This surface does not create a second resource authority.
        </p>
      </header>

      {error ? <StatePanel title="Resource operation blocked" body={error} tone="error" /> : null}

      <section className="atlas-cloud-kpi-grid">
        <article><span>Projects</span><strong>{data?.projects?.length ?? '—'}</strong></article>
        <article><span>Registered services</span><strong>{data?.services?.length ?? '—'}</strong></article>
        <article>
          <span>Enabled services</span>
          <strong>{data?.services?.filter((service) => service.enabled).length ?? '—'}</strong>
        </article>
        <article><span>Backends</span><strong>{servicesByBackend.length || '—'}</strong></article>
      </section>

      <section className="atlas-cloud-resource-layout">
        <article className="atlas-cloud-toolbox">
          <div>
            <p className="eyebrow">Projects</p>
            <h2>Organization projects</h2>
          </div>

          {data?.projects?.length ? (
            <div className="atlas-cloud-project-list">
              {data.projects.map((project) => (
                <button key={project.id} type="button" onClick={() => void openProject(project.id)}>
                  <span><strong>{project.name}</strong><small>{project.status} · {project.priority}</small></span>
                  <span>Open →</span>
                </button>
              ))}
            </div>
          ) : (
            <StatePanel
              title="No project records yet"
              body="Create the first Atlas Cloud project below. The record will be written through existing project RLS."
            />
          )}

          <form className="atlas-cloud-project-form" onSubmit={createProject}>
            <h3>Create project</h3>
            <label>
              <span>Name</span>
              <input
                required
                maxLength={160}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                maxLength={2000}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <label>
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create project'}</button>
          </form>
        </article>

        <article className="atlas-cloud-toolbox">
          <div>
            <p className="eyebrow">Service graph</p>
            <h2>Services by data backend</h2>
            <p>Visual grouping comes directly from <code>atlas_module_registry</code>.</p>
          </div>
          <div className="atlas-cloud-service-map">
            {servicesByBackend.map(([backend, services]) => (
              <section key={backend}>
                <h3>{backend}</h3>
                <div>
                  {services.map((service) => (
                    <span
                      key={service.module_code}
                      className={service.launch_status === 'active' && service.enabled ? 'active' : 'limited'}
                      title={service.launch_status}
                    >
                      {service.module_code}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>

      {selected ? (
        <section className="atlas-cloud-toolbox">
          <div className="atlas-cloud-section-heading">
            <div><p className="eyebrow">Project detail</p><h2>Execution view</h2></div>
            <button type="button" onClick={() => setSelected(null)}>Close</button>
          </div>
          <pre className="atlas-cloud-json-result">{JSON.stringify(selected, null, 2)}</pre>
        </section>
      ) : null}

      {data?.truth ? (
        <p className="atlas-cloud-truth-note">
          Project authority: <code>{data.truth.project_authority}</code> · Service authority:{' '}
          <code>{data.truth.service_authority}</code> · Duplicate registry created:{' '}
          {data.truth.duplicated_registry_created ? 'yes' : 'no'}
        </p>
      ) : null}
    </section>
  );
}
