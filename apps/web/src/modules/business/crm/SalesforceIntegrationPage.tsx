import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CrmConnectionView } from '../../../../../../packages/core/src/crm';
import { CrmApiError, crmApi } from './crmApi';

type SalesforceEnvironment = 'production' | 'sandbox';

type SalesforceConfiguration = {
  configured: boolean;
  redirectUri: string;
  environment: SalesforceEnvironment;
  apiVersion: string;
};

type SalesforceCandidate = {
  id: string;
  state: CrmConnectionView['state'];
  providerAccountId: string | null;
  providerAccountLabel: string | null;
  instanceUrl: string | null;
  grantedScopes: string[];
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  safeErrorCode: string | null;
  metadata: {
    canonical: boolean;
    classification: string;
    userId: string | null;
    username: string | null;
    organizationType: string | null;
    instanceName: string | null;
    isSandbox: boolean | null;
    apiVersion: string | null;
    recordCounts: Record<string, number | null> | null;
    inventoryProbedAt: string | null;
  };
};

type SalesforceStatus = {
  connection: CrmConnectionView;
  candidateCount: number;
  canonicalRequired: boolean;
};

const connectionLabel: Record<CrmConnectionView['state'], string> = {
  unconfigured: 'Not configured',
  authorizing: 'Authorizing',
  connected: 'Connected',
  degraded: 'Degraded',
  expired: 'Expired',
  revoked: 'Revoked',
  error: 'Error'
};

function safeError(error: unknown): string {
  if (error instanceof CrmApiError) {
    if (error.code === 'canonical_org_required') {
      return 'Multiple Salesforce production organizations are verified. Inventory both organizations and select the canonical production org.';
    }
    if (error.code === 'org_inventory_required') {
      return 'Inventory every verified Salesforce organization before selecting the canonical production org.';
    }
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  return 'Salesforce connection operation failed.';
}

function verifiedSalesforceAuthorizationUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Salesforce authorization URL was not returned');
  }
  const url = new URL(value);
  const allowedHost =
    url.hostname === 'login.salesforce.com' ||
    url.hostname === 'test.salesforce.com' ||
    url.hostname.endsWith('.my.salesforce.com') ||
    url.hostname.endsWith('.sandbox.my.salesforce.com');
  if (
    url.protocol !== 'https:' ||
    !allowedHost ||
    url.pathname !== '/services/oauth2/authorize'
  ) {
    throw new Error('Salesforce authorization URL is invalid');
  }
  return url.toString();
}

function countSummary(candidate: SalesforceCandidate): string {
  const counts = candidate.metadata.recordCounts;
  if (!counts) return 'Inventory not yet captured';
  return Object.entries(counts)
    .map(([name, value]) => `${name}: ${value === null ? 'unavailable' : value.toLocaleString()}`)
    .join(' · ');
}

export function SalesforceIntegrationPage() {
  const [status, setStatus] = useState<SalesforceStatus | null>(null);
  const [configuration, setConfiguration] = useState<SalesforceConfiguration | null>(null);
  const [candidates, setCandidates] = useState<SalesforceCandidate[]>([]);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [environment, setEnvironment] = useState<SalesforceEnvironment>('production');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, configurationResult, candidatesResult] = await Promise.all([
        crmApi<SalesforceStatus>('connection.status', {}, 'salesforce'),
        crmApi<SalesforceConfiguration>('connection.configuration', {}, 'salesforce'),
        crmApi<{ candidates: SalesforceCandidate[] }>('org.candidates', {}, 'salesforce')
      ]);
      setStatus(statusResult);
      setConfiguration(configurationResult);
      setCandidates(candidatesResult.candidates);
      setEnvironment(configurationResult.environment);
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const configureOAuth = async () => {
    setAction('configuring');
    setError(null);
    try {
      const result = await crmApi<SalesforceConfiguration>('oauth.configure', {
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        environment
      }, 'salesforce');
      setConfiguration(result);
      setOauthClientId('');
      setOauthClientSecret('');
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setAction(null);
    }
  };

  const connect = async () => {
    setAction('authorizing');
    setError(null);
    try {
      const result = await crmApi<{ authorizationUrl: string }>(
        'oauth.prepare',
        {},
        'salesforce'
      );
      window.location.assign(verifiedSalesforceAuthorizationUrl(result.authorizationUrl));
    } catch (caught) {
      setError(safeError(caught));
      setAction(null);
    }
  };

  const inventory = async (connectionId: string) => {
    setAction(`inventory:${connectionId}`);
    setError(null);
    try {
      await crmApi('org.inventory', { connectionId }, 'salesforce');
      await refreshStatus();
    } catch (caught) {
      setError(safeError(caught));
      setAction(null);
    }
  };

  const selectCanonical = async (connectionId: string) => {
    setAction(`canonical:${connectionId}`);
    setError(null);
    try {
      await crmApi('org.selectCanonical', { connectionId }, 'salesforce');
      await refreshStatus();
    } catch (caught) {
      setError(safeError(caught));
      setAction(null);
    }
  };

  const disconnect = async (connectionId: string) => {
    setAction(`disconnect:${connectionId}`);
    setError(null);
    try {
      await crmApi('connection.disconnect', { connectionId }, 'salesforce');
      await refreshStatus();
    } catch (caught) {
      setError(safeError(caught));
      setAction(null);
    }
  };

  const inventoriesReady = useMemo(
    () => candidates.length > 0 && candidates.every((candidate) => Boolean(candidate.metadata.inventoryProbedAt)),
    [candidates]
  );
  const state = status?.connection.state ?? 'unconfigured';

  return (
    <section className="crm-page page-stack" aria-labelledby="salesforce-integration-title">
      <header className="page-header crm-hero">
        <div>
          <p className="eyebrow">ATLAS CRM · Direct Provider</p>
          <h1 id="salesforce-integration-title">Salesforce Integration</h1>
          <p>
            Direct ATLAS OAuth and REST integration. This path does not depend on the ChatGPT Salesforce plugin.
          </p>
        </div>
        <span className={`crm-status ${state}`} aria-live="polite">
          {action === 'authorizing' ? 'Authorizing' : connectionLabel[state]}
        </span>
      </header>

      {loading ? <div className="crm-loading" role="status">Loading Salesforce connection status…</div> : null}
      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}
      {status?.canonicalRequired ? (
        <div className="crm-banner degraded" role="status">
          <strong>Canonical production org required</strong>
          <span>ATLAS detected multiple immutable Salesforce Organization IDs. Inventory all candidates, compare them, then select the canonical org.</span>
        </div>
      ) : null}

      {!loading && configuration ? (
        <section className="crm-scope-panel" aria-labelledby="salesforce-oauth-setup">
          <h2 id="salesforce-oauth-setup">
            {configuration.configured ? 'Replace Salesforce OAuth credentials' : 'Salesforce OAuth app setup'}
          </h2>
          <p>
            Configure a Salesforce External Client App or Connected App with the callback below.
            Secrets are sent to the ATLAS backend and stored in the existing encrypted server secret store.
          </p>
          <dl className="crm-field-grid">
            <div><dt>Callback URL</dt><dd><code>{configuration.redirectUri}</code></dd></div>
            <div><dt>Environment</dt><dd>{configuration.environment}</dd></div>
            <div><dt>API version</dt><dd>{configuration.apiVersion}</dd></div>
          </dl>
          <div className="crm-form-grid">
            <label>
              Client ID / Consumer Key
              <input
                value={oauthClientId}
                onChange={(event) => setOauthClientId(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Client Secret / Consumer Secret
              <input
                type="password"
                value={oauthClientSecret}
                onChange={(event) => setOauthClientSecret(event.target.value)}
                autoComplete="new-password"
                spellCheck={false}
              />
            </label>
            <label>
              Salesforce environment
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as SalesforceEnvironment)}
              >
                <option value="production">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </label>
          </div>
          <div className="crm-actions">
            <button
              type="button"
              onClick={() => void configureOAuth()}
              disabled={action !== null || !oauthClientId.trim() || oauthClientSecret.trim().length < 8}
            >
              {action === 'configuring'
                ? 'Saving securely…'
                : configuration.configured
                  ? 'Replace OAuth configuration'
                  : 'Save OAuth configuration'}
            </button>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={action !== null || configuration.configured !== true}
            >
              {action === 'authorizing' ? 'Opening Salesforce…' : 'Connect Salesforce org'}
            </button>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="crm-scope-panel" aria-labelledby="salesforce-orgs-title">
          <h2 id="salesforce-orgs-title">Verified Salesforce organizations</h2>
          {candidates.length === 0 ? (
            <div className="empty-state">
              <strong>No Salesforce organization verified</strong>
              <span>Configure OAuth, then authorize the first Salesforce production organization.</span>
            </div>
          ) : (
            <div className="page-stack">
              {candidates.map((candidate) => (
                <article className="module-card enabled" key={candidate.id}>
                  <span>
                    {candidate.metadata.canonical
                      ? 'Canonical'
                      : candidate.metadata.classification === 'unknown'
                        ? 'Candidate'
                        : candidate.metadata.classification}
                  </span>
                  <strong>{candidate.providerAccountLabel || 'Salesforce organization'}</strong>
                  <p>Organization ID: <code>{candidate.providerAccountId || 'Unavailable'}</code></p>
                  <p>Instance: {candidate.instanceUrl || 'Unavailable'}</p>
                  <p>
                    Type: {candidate.metadata.organizationType || 'Unavailable'}
                    {' · '}Sandbox: {candidate.metadata.isSandbox === null ? 'Unknown' : candidate.metadata.isSandbox ? 'Yes' : 'No'}
                  </p>
                  <p>{countSummary(candidate)}</p>
                  <p>
                    Inventory: {candidate.metadata.inventoryProbedAt
                      ? new Date(candidate.metadata.inventoryProbedAt).toLocaleString()
                      : 'Not yet captured'}
                  </p>
                  <div className="crm-actions">
                    <button
                      type="button"
                      onClick={() => void inventory(candidate.id)}
                      disabled={action !== null}
                    >
                      {action === `inventory:${candidate.id}` ? 'Inventorying…' : 'Inventory / verify'}
                    </button>
                    {candidates.length > 1 && !candidate.metadata.canonical ? (
                      <button
                        type="button"
                        onClick={() => void selectCanonical(candidate.id)}
                        disabled={action !== null || !inventoriesReady}
                      >
                        {action === `canonical:${candidate.id}` ? 'Selecting…' : 'Select as canonical'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void disconnect(candidate.id)}
                      disabled={action !== null}
                    >
                      {action === `disconnect:${candidate.id}` ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {status?.connection.state === 'connected' && !status.canonicalRequired ? (
        <section className="crm-scope-panel" aria-labelledby="salesforce-data-title">
          <h2 id="salesforce-data-title">Read-only CRM access</h2>
          <p>
            The verified canonical Salesforce org is available through ATLAS provider-neutral CRM reads.
            Provider write operations remain disabled in this phase.
          </p>
          <div className="crm-actions">
            <a className="text-link" href="/crm/salesforce/contacts">Contacts</a>
            <a className="text-link" href="/crm/salesforce/companies">Accounts</a>
            <a className="text-link" href="/crm/salesforce/deals">Opportunities</a>
            <a className="text-link" href="/crm/salesforce/service">Cases</a>
          </div>
        </section>
      ) : null}

      <div className="notice">
        Salesforce access tokens, refresh tokens, client secrets and ATLAS encryption keys are never rendered by this page.
        Duplicate Salesforce production organizations are fail-closed until inventory evidence supports a canonical selection.
      </div>
    </section>
  );
}
