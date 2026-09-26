import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWirelessCommissioning, type CommissioningRun } from '../../lib/wirelessCommissioningApi';

export function AtlasWirelessCommissioningPage() {
  const [runs, setRuns] = useState<CommissioningRun[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listWirelessCommissioning()
      .then((result) => {
        if (!active) return;
        setRuns(result.runs);
        setTaskCount(result.tasks.length);
        setError('');
      })
      .catch((reason) => {
        if (!active) return;
        setRuns([]);
        setTaskCount(0);
        setError(reason instanceof Error ? reason.message : 'commissioning_unavailable');
      });
    return () => { active = false; };
  }, []);

  const commissioned = useMemo(() => runs.filter((run) => run.state === 'commissioned').length, [runs]);
  const activeRuns = useMemo(() => runs.filter((run) => run.state !== 'commissioned' && run.state !== 'rejected').length, [runs]);

  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-commissioning-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless Department</p>
        <h1 id="atlas-wireless-commissioning-title">Physical Commissioning</h1>
        <p>Evidence-gated commissioning for ATLAS-owned radio sites. No run becomes commissioned from configuration, purchase orders or UI state alone.</p>
      </header>

      <div className="stat-grid">
        <article><strong>{runs.length}</strong><span>commissioning runs</span></article>
        <article><strong>{activeRuns}</strong><span>active / evidence-gathering</span></article>
        <article><strong>{commissioned}</strong><span>fully commissioned</span></article>
      </div>

      <div className="notice" role="status">
        {error
          ? `Commissioning API unavailable: ${error}. Status remains fail-closed.`
          : `${taskCount} evidence task record(s) loaded from the authenticated organization.`}
      </div>

      <article className="feature-card">
        <p className="eyebrow">Required physical evidence</p>
        <h2>12 commissioning gates</h2>
        <ol>
          <li>Physical site verified</li>
          <li>Radio commissioned</li>
          <li>Spectrum authorization verified</li>
          <li>SAS coordination verified or evidenced not applicable</li>
          <li>ATLAS core reachable</li>
          <li>Backhaul operational</li>
          <li>Subscriber identity ready</li>
          <li>Device attach verified</li>
          <li>Data path verified</li>
          <li>Observability verified</li>
          <li>Emergency-service boundary verified</li>
          <li>RF safety evidence verified</li>
        </ol>
      </article>

      <div className="module-grid">
        {runs.map((run) => (
          <article className="feature-card" key={run.id}>
            <p className="eyebrow">{run.site_code}</p>
            <h2>{run.display_name}</h2>
            <p>Mode: {run.target_mode}</p>
            <p>State: <strong>{run.state}</strong></p>
            <p>{run.state === 'commissioned' ? 'Approved with physical evidence.' : 'Not yet commissioned.'}</p>
          </article>
        ))}
      </div>

      <div className="row-actions">
        <Link className="text-link" to="/connect/wireless/network">Back to network control</Link>
        <Link className="text-link" to="/connect/wireless">Back to ATLAS Wireless</Link>
      </div>
    </section>
  );
}
