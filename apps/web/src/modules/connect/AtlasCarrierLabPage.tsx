import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  executeCarrierLab,
  type CarrierLabChannel,
  type CarrierLabScenario,
  type CarrierLabReport
} from '../../lib/carrierLabApi';

export function AtlasCarrierLabPage() {
  const [channel, setChannel] = useState<CarrierLabChannel>('voice');
  const [scenario, setScenario] = useState<CarrierLabScenario>('success');
  const [count, setCount] = useState(100);
  const [seed, setSeed] = useState(777);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CarrierLabReport | null>(null);

  async function run() {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const result = await executeCarrierLab({ channel, scenario, count, seed });
      setReport(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'lab_unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-stack" aria-labelledby="carrier-lab-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Carrier Lab 777</p>
        <h1 id="carrier-lab-title">Telecommunications Test Lab</h1>
        <p>Deterministic, offline-only simulations. No real telephone numbers, eSIM profiles, SMS or cellular calls are created.</p>
      </header>
      <div className="notice" role="status">
        SIMULATION ONLY · Not certified for live PSTN, cellular or emergency communications.
      </div>
      <div className="feature-card">
        <h2>Run an isolated scenario</h2>
        <label htmlFor="carrier-lab-channel">Channel</label>
        <select id="carrier-lab-channel" value={channel} onChange={e => setChannel(e.target.value as CarrierLabChannel)}>
          <option value="voice">Voice</option>
          <option value="sms">SMS</option>
          <option value="data">Mobile data</option>
          <option value="esim">eSIM</option>
        </select>
        <label htmlFor="carrier-lab-scenario">Scenario</label>
        <select id="carrier-lab-scenario" value={scenario} onChange={e => setScenario(e.target.value as CarrierLabScenario)}>
          <option value="success">Simulated success</option>
          <option value="provider_unavailable">Provider unavailable</option>
          <option value="timeout">Timeout</option>
          <option value="unauthorized">Unauthorized</option>
        </select>
        <label htmlFor="carrier-lab-count">Events (1–10,000)</label>
        <input id="carrier-lab-count" type="number" min={1} max={10000} step={1} value={count} onChange={e => setCount(Number(e.target.value))} />
        <label htmlFor="carrier-lab-seed">Repeatable seed</label>
        <input id="carrier-lab-seed" type="number" min={0} max={4294967295} step={1} value={seed} onChange={e => setSeed(Number(e.target.value))} />
        <button type="button" disabled={busy || !Number.isSafeInteger(count) || count < 1 || count > 10000 || !Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295} onClick={run}>
          {busy ? 'Running…' : 'Run synthetic test'}
        </button>
      </div>
      {error && <div role="alert" className="notice">Lab execution unavailable: {error}</div>}
      {report && (
        <div className="feature-card" role="status" aria-live="polite">
          <h2>Simulation report</h2>
          <p>Mode: {report.mode} · Production ready: no</p>
          <p>Events: {report.total} · Simulated success: {report.passed} · Simulated failure: {report.failed}</p>
          <p>Every event is synthetic. No phone number, provider activation or eSIM has been issued.</p>
        </div>
      )}
      <Link className="text-link" to="/connect/wireless/mvno">Back to MVNO Control Plane</Link>
    </section>
  );
}
