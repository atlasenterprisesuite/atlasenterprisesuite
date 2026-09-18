import { useEffect, useState } from 'react';
import {
  createLocalNetworkEndpoint,
  listLocalNetworkEndpoints,
  recordLocalNetworkEvent,
  setLocalNetworkEndpointEnabled
} from './localNetworkApi';
import {
  probeLocalNetworkEndpoint,
  type AtlasLocalEndpoint
} from './localNetworkAccess';

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : 'local_network_operation_failed';
  const known: Record<string, string> = {
    invalid_local_endpoint_url: 'Enter a valid local URL, for example http://192.168.1.20:8080.',
    local_endpoint_protocol_not_allowed: 'Only HTTP and HTTPS local endpoints are allowed.',
    local_endpoint_credentials_not_allowed: 'Do not embed usernames or passwords in the endpoint URL.',
    local_endpoint_origin_only: 'Save only the endpoint origin. Put the health path in Probe path.',
    local_endpoint_not_non_public: 'P0 accepts only localhost, private/link-local IPs, or .local hosts.',
    secure_context_required: 'ATLAS must be served from a secure HTTPS context before local network access can run.',
    local_endpoint_disabled: 'This local endpoint is disabled.',
    local_endpoint_address_space_mismatch: 'The saved address-space classification no longer matches the endpoint.',
    local_network_scope_mismatch: 'The endpoint does not belong to the active ATLAS organization.'
  };
  return known[code] ?? code.replaceAll('_', ' ');
}

export function LocalNetworkAccessPanel() {
  const [endpoints, setEndpoints] = useState<AtlasLocalEndpoint[]>([]);
  const [label, setLabel] = useState('');
  const [origin, setOrigin] = useState('');
  const [probePath, setProbePath] = useState('/');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Loading governed endpoint allowlist…');

  async function refresh() {
    try {
      const rows = await listLocalNetworkEndpoints();
      setEndpoints(rows);
      setStatus(rows.length
        ? 'Only these explicitly allowlisted endpoints can be probed by ATLAS.'
        : 'No local endpoints are allowlisted for this organization.');
    } catch (error) {
      setStatus(messageFor(error));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addEndpoint() {
    setBusy('add');
    try {
      await createLocalNetworkEndpoint({ label, origin, probePath });
      setLabel('');
      setOrigin('');
      setProbePath('/');
      await refresh();
    } catch (error) {
      setStatus(messageFor(error));
    } finally {
      setBusy(null);
    }
  }

  async function probe(endpoint: AtlasLocalEndpoint) {
    setBusy(endpoint.id);
    setStatus(`Requesting governed access to ${endpoint.label}…`);
    try {
      // Audit is written before touching the LAN. If governance evidence cannot
      // be written, execution fails closed and no local request is attempted.
      await recordLocalNetworkEvent({
        endpoint,
        eventType: 'probe_requested',
        success: null
      });

      const result = await probeLocalNetworkEndpoint(endpoint);
      await recordLocalNetworkEvent({
        endpoint,
        eventType: result.reachable ? 'probe_succeeded' : 'probe_failed',
        success: result.reachable,
        httpStatus: result.status
      });
      setStatus(
        result.reachable
          ? `${endpoint.label} responded with HTTP ${result.status}. Browser LNA permission and CORS both allowed the probe.`
          : `${endpoint.label} did not respond.`
      );
    } catch (error) {
      const code = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'permission_denied'
        : error instanceof Error
          ? error.message
          : 'local_network_probe_failed';

      try {
        await recordLocalNetworkEvent({
          endpoint,
          eventType: code === 'permission_denied' ? 'permission_denied' : 'probe_failed',
          success: false,
          errorCode: code
        });
      } catch {
        // Preserve the primary error; a missing audit write must never be
        // represented as a successful local connection.
      }
      setStatus(messageFor(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(endpoint: AtlasLocalEndpoint) {
    setBusy(endpoint.id);
    try {
      await setLocalNetworkEndpointEnabled(endpoint.id, !endpoint.enabled);
      await refresh();
    } catch (error) {
      setStatus(messageFor(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="atlas-lna-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Local Device Bridge</p>
          <h2 id="atlas-lna-title">Local Network Access</h2>
        </div>
        <span className="status-chip neutral">Fail-closed</span>
      </div>

      <p>
        Connect ATLAS to an explicitly approved local service without scanning the LAN.
        Chrome controls the Local Network Access permission; ATLAS adds tenant scope,
        RBAC, an endpoint allowlist and append-only audit evidence.
      </p>

      <div className="notice">
        Direct browser probes use CORS, omit credentials, reject redirects and send no
        ATLAS token to the local device. A successful LNA permission does not activate a
        hotel lock, POS, printer or other provider capability by itself.
      </div>

      <div className="crm-form-grid">
        <label>
          Endpoint label
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Front desk bridge" />
        </label>
        <label>
          Local origin
          <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="http://192.168.1.20:8080" />
        </label>
        <label>
          Probe path
          <input value={probePath} onChange={(event) => setProbePath(event.target.value)} placeholder="/health" />
        </label>
      </div>

      <div className="crm-actions">
        <button
          type="button"
          onClick={() => void addEndpoint()}
          disabled={busy !== null || !label.trim() || !origin.trim()}
        >
          {busy === 'add' ? 'Saving…' : 'Add to allowlist'}
        </button>
      </div>

      <div className="notice" role="status">{status}</div>

      {endpoints.length ? (
        <div className="module-grid compact" aria-label="Allowlisted local endpoints">
          {endpoints.map((endpoint) => (
            <div className="module-card" key={endpoint.id}>
              <span>{endpoint.address_space}</span>
              <strong>{endpoint.label}</strong>
              <p><code>{endpoint.origin}{endpoint.probe_path}</code></p>
              <span className={endpoint.enabled ? 'status-chip' : 'status-chip warning'}>
                {endpoint.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <div className="crm-actions">
                <button
                  type="button"
                  onClick={() => void probe(endpoint)}
                  disabled={busy !== null || !endpoint.enabled}
                >
                  {busy === endpoint.id ? 'Checking…' : 'Test connection'}
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(endpoint)}
                  disabled={busy !== null}
                >
                  {endpoint.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
