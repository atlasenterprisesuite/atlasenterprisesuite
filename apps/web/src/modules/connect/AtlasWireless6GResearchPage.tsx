import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { evaluateReadiness, simulateScenario, REQUIREMENTS } from '../../../../../research/atlas-wireless-6g/atlas-6g-pioneer.mjs';

const defaults = { offeredMbps: 150, capacityMbps: 100, baseLatencyMs: 10, jitterMs: 0 };

export function AtlasWireless6GResearchPage() {
  const [scenario, setScenario] = useState(defaults);
  const result = useMemo(() => {
    try { return simulateScenario(scenario); }
    catch (reason) { return null; }
  }, [scenario]);
  const readiness = evaluateReadiness();
  function change(field: keyof typeof defaults, value: string) {
    setScenario((current) => ({ ...current, [field]: value.trim() === '' ? NaN : Number(value) }));
  }
  function onReset() { setScenario(defaults); }
  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-6g-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless · Research only</p>
        <h1 id="atlas-wireless-6g-title">ATLAS Wireless 6G Pioneer Lab</h1>
        <p>Explore an illustrative synthetic network capacity model. No measured 6G performance, carrier integration, RF transmissions or subscriber activation.</p>
      </header>
      <div className="notice" role="status">
        Research only · No radio control, provider credentials, eSIM activation, network access or commercial 6G service.
      </div>
      <article className="feature-card">
        <h2>Capacity simulation (synthetic)</h2>
        <p>Inputs are illustrative. This model does not predict real-world wireless throughput or latency.</p>
        <div className="module-grid">
          {([
            ['offeredMbps', 'Offered traffic (Mbps)'],
            ['capacityMbps', 'Configured capacity (Mbps)'],
            ['baseLatencyMs', 'Base latency (ms)'],
            ['jitterMs', 'Added jitter (ms)']
          ] as const).map(([field, label]) => (
            <label key={field} style={{ display: 'grid', gap: '0.5rem' }}>
              <span>{label}</span>
              <input aria-label={label} type="number" min="0" step="any"
                value={Number.isNaN(scenario[field]) ? '' : scenario[field]}
                onChange={(event) => change(field, event.target.value)} />
            </label>
          ))}
        </div>
        <div className="row-actions">
          <button type="button" onClick={onReset}>Reset synthetic example</button>
        </div>
        {!result ? <p role="alert">Invalid model inputs. Capacity must exceed zero and all inputs must be finite and nonnegative.</p> : (
          <div className="stat-grid" aria-label="Synthetic simulation results">
            <article><strong>{result.deliveredMbps.toFixed(1)} Mbps</strong><span>delivered (modeled)</span></article>
            <article><strong>{result.estimatedLossPercent.toFixed(1)}%</strong><span>loss (modeled)</span></article>
            <article><strong>{result.modeledLatencyMs.toFixed(1)} ms</strong><span>latency (heuristic)</span></article>
          </div>
        )}
      </article>
      <article className="feature-card" aria-labelledby="wireless-6g-readiness">
        <p className="eyebrow">ATLAS 777 REVIEW · Fail closed</p>
        <h2 id="wireless-6g-readiness">Research evidence checklist</h2>
        <p>Verified research items: {readiness.checks.filter((item) => item.verified).length}/{REQUIREMENTS.length}. External records are not connected to this research page.</p>
        <ul>{readiness.checks.map((item) => <li key={item.requirement}>{item.requirement.replaceAll('_', ' ')} — {item.verified ? 'Verified' : 'Not verified'}</li>)}</ul>
        <p><strong>6G service:</strong> Blocked. <strong>Commercial activation:</strong> Blocked.</p>
      </article>
      <div className="row-actions">
        <Link className="text-link" to="/connect/wireless">Back to ATLAS Wireless</Link>
        <Link className="text-link" to="/connect/wireless/network">Network readiness</Link>
      </div>
    </section>
  );
}
