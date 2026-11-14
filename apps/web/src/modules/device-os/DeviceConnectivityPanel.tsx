import React, { useEffect, useState } from 'react';
import { listLocalAgents, listLocalDevices } from './localControlApi';
import {
  probeCurrentAtlasOrigin,
  projectDeviceConnectivity,
  type AtlasOriginProbe,
  type DeviceConnectivityRow,
  type DeviceControlState
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
      <a href="/work/computer-operations">Open ATLAS advanced network diagnostics</a>
    </article>
  );
}
