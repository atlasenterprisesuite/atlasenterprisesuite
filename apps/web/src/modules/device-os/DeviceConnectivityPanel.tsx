import React, { useEffect, useState } from 'react';
import { listLocalAgents, listLocalDevices } from './localControlApi';
import {
  probeCurrentAtlasOrigin,
  projectDeviceConnectivity,
  parseWindowsConnectivityReport,
  assessWindowsConnectivityReport,
  guideIphoneManualCheck,
  type IphoneManualCheck,
  type AtlasOriginProbe,
  type DeviceConnectivityRow,
  type DeviceControlState,
  type WindowsConnectivityReport
} from './deviceConnectivity';

const CONTROL_LABELS: Record<DeviceControlState, string> = {
  'agent-recent': 'Recent agent heartbeat (active mTLS binding)',
  'secure-channel-required': 'Secure mTLS channel required',
  stale: 'Heartbeat missing or stale',
  offline: 'Agent reports offline',
  revoked: 'Agent revoked',
  unverified: 'Agent not verified'
};

export function DeviceConnectivityPanel() {
  const [rows, setRows] = useState<DeviceConnectivityRow[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [originProbe, setOriginProbe] = useState<AtlasOriginProbe | null>(null);
  const [windowsInput, setWindowsInput] = useState('');
  const [windowsReport, setWindowsReport] = useState<WindowsConnectivityReport | null>(null);
  const [windowsError, setWindowsError] = useState('');
  const [iphoneCheck, setIphoneCheck] = useState<IphoneManualCheck>({
    wifi: 'unknown', cellular: 'unknown', hotspot: 'unknown', vpn: 'unknown'
  });
  const [showIphoneGuidance, setShowIphoneGuidance] = useState(false);

  async function refresh() {
    setState('loading');
    setRows([]);
    setOriginProbe(null);
    try {
      const [agents, devices] = await Promise.all([listLocalAgents(), listLocalDevices()]);
      setRows(projectDeviceConnectivity(agents, devices));
      setState('loaded');
      setError('');
    } catch {
      // Never show stale agent results after authorization failure or network error.
      setRows([]);
      setState('error');
      setError('Unable to verify registered devices. Confirm your ATLAS session and organization access.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function checkBrowser() {
    setChecking(true);
    setOriginProbe(null);
    try {
      setOriginProbe(await probeCurrentAtlasOrigin({ origin: window.location.origin }));
    } catch {
      setOriginProbe({ state: 'unavailable', httpStatus: null, scope: 'current-atlas-origin-only' });
    } finally {
      setChecking(false);
    }
  }

  function inspectWindowsReport() {
    setWindowsReport(null);
    try {
      setWindowsReport(parseWindowsConnectivityReport(windowsInput));
      setWindowsError('');
      setWindowsInput('');
    } catch {
      setWindowsError('Invalid report. Paste only sanitized JSON from the ATLAS read-only Windows diagnostics script.');
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="device-connectivity-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Device OS · Network Sentinel</p>
          <h2 id="device-connectivity-title">Internet &amp; device connectivity</h2>
        </div>
        <span className="status-chip neutral">Read-only · Fail Closed</span>
      </div>
      <p>
        Consolidated view of registered ATLAS devices. Agent heartbeats verify only recent
        control-plane reporting, never general Internet, Wi-Fi, cellular or WireGuard access.
        No network discovery or configuration changes are performed.
      </p>

      <div className="filter-row">
        <button type="button" onClick={() => void refresh()} disabled={state === 'loading'}>
          {state === 'loading' ? 'Checking devices…' : 'Refresh registered devices'}
        </button>
        <button type="button" onClick={() => void checkBrowser()} disabled={checking}>
          {checking ? 'Checking ATLAS…' : 'Check this browser → ATLAS'}
        </button>
      </div>

      <div className="notice" role="status" aria-live="polite">
        {originProbe
          ? originProbe.state === 'reachable'
            ? 'This browser reached the current ATLAS web origin over HTTP (200). Other Internet destinations, DNS, Wi-Fi and VPN remain unverified.'
            : 'The ATLAS origin check did not return HTTP 200. This does not identify a DNS, Wi-Fi, VPN or service cause.'
          : 'Browser origin has not been checked in this session.'}
      </div>

      {state === 'error' ? <div className="notice" role="alert">{error}</div> : null}
      {state === 'loading' ? <p role="status">Retrieving organization-scoped device inventory…</p> : null}
      {state === 'loaded' && !rows.length ? (
        <div className="notice" role="status">
          No registered devices are reporting in the current organization.
          Enroll a Local Agent using the existing Agents &amp; Devices section below.
        </div>
      ) : null}
      {state === 'loaded' && rows.length > 0 ? (
        <div className="module-grid compact" aria-label="Registered device connectivity">
          {rows.map((row) => (
            <section className="module-card" key={row.id} aria-label={row.label}>
              <span>{row.platform}</span>
              <strong>{row.label}</strong>
              <p>ATLAS control: {CONTROL_LABELS[row.controlState]}</p>
              <p>Internet: not measured · Wi-Fi: not measured</p>
              <p>Cellular: not measured · VPN: not measured</p>
              <small>Agent last seen: {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : 'No timestamp'}</small>
            </section>
          ))}
        </div>
      ) : null}
      <div className="notice">
        iPhone: check Settings → Wi-Fi / Cellular / Personal Hotspot / VPN.
        Windows: run read-only adapter, IP, DNS and HTTPS diagnostics on your own laptop.
        ATLAS cannot control operating-system radios, hotspot settings or WireGuard
        without an enrolled, authorized platform adapter.
      </div>
      <div className="page-stack">
        <h3>Windows local diagnostics (optional)</h3>
        <p>
          Run scripts/network/atlas-windows-connectivity.ps1 locally on your own Windows laptop
          and paste the sanitized JSON. Nothing is uploaded or saved; results are self-reported,
          not proof of an enrolled device, Internet service or a working VPN tunnel.
        </p>
        <p>
          <a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/blob/main/scripts/network/atlas-windows-connectivity.ps1" target="_blank" rel="noreferrer">
            Review the read-only PowerShell script in the canonical repository
          </a>
        </p>
        <label htmlFor="atlas-windows-connectivity-report">Sanitized Windows diagnostic JSON</label>
        <textarea
          id="atlas-windows-connectivity-report"
          rows={3}
          maxLength={4096}
          value={windowsInput}
          onChange={(event) => setWindowsInput(event.target.value)}
          placeholder="Paste JSON produced by the ATLAS read-only Windows diagnostic"
        />
        <div>
          <button type="button" disabled={!windowsInput.trim()} onClick={inspectWindowsReport}>
            Validate locally
          </button>
        </div>
        {windowsError ? <p role="alert">{windowsError}</p> : null}
        {windowsReport ? (
          <div role="status" className="notice">
            <strong>User-reported Windows diagnostics — not independently verified</strong>
            <p>Adapter(s) reporting up: {windowsReport.adaptersUpCount}</p>
            <p>DNS example.com: {windowsReport.dnsResolved ? 'resolved' : 'not resolved by this check'}</p>
            <p>TCP 443 to 1.1.1.1: {windowsReport.tcp443Reachable ? 'reachable' : 'not reachable by this check'}</p>
            <p>
              WireGuard adapter: {windowsReport.wireGuardAdapterUp
                ? 'interface up; tunnel handshake not verified'
                : windowsReport.wireGuardAdapterPresent ? 'present, not up' : 'not detected'}
            </p>
            <small>Local report timestamp: {new Date(windowsReport.measuredAt).toLocaleString()}</small>
            <p>Diagnosis: {assessWindowsConnectivityReport(windowsReport).state.replaceAll('-', ' ')}</p>
            <ul>
              {assessWindowsConnectivityReport(windowsReport).findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <section className="page-stack" aria-labelledby="iphone-connectivity-title">
        <h3 id="iphone-connectivity-title">iPhone — manual connectivity check</h3>
        <p>
          Choose only what you can verify yourself in iOS Settings. ATLAS does not
          access your iPhone settings, carrier account, Wi-Fi passwords or VPN keys.
          Answers remain in this page session and are not transmitted.
        </p>
        {([
          ['wifi', 'Wi-Fi connected in iOS Settings?'],
          ['cellular', 'Cellular data available?'],
          ['hotspot', 'Personal Hotspot enabled?'],
          ['vpn', 'VPN switch enabled?']
        ] as const).map(([field, fieldLabel]) => (
          <label key={field}>
            {fieldLabel}
            <select
              value={iphoneCheck[field]}
              onChange={(event) => {
                setIphoneCheck((old) => ({ ...old, [field]: event.target.value as IphoneManualCheck[typeof field] }));
                setShowIphoneGuidance(false);
              }}
            >
              <option value="unknown">Not checked</option>
              <option value="yes">Yes, observed in Settings</option>
              <option value="no">No, observed in Settings</option>
            </select>
          </label>
        ))}
        <div>
          <button type="button" onClick={() => setShowIphoneGuidance(true)}>
            Explain my iPhone results
          </button>
          <button type="button" onClick={() => {
            setIphoneCheck({ wifi: 'unknown', cellular: 'unknown', hotspot: 'unknown', vpn: 'unknown' });
            setShowIphoneGuidance(false);
          }}>Clear my iPhone answers</button>
        </div>
        {showIphoneGuidance ? (
          <div role="status" className="notice">
            <strong>iPhone self-report — not device-verified</strong>
            <ul>
              {guideIphoneManualCheck(iphoneCheck).map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <a href="/work/computer-operations">Open ATLAS advanced network diagnostics</a>
    </article>
  );
}
