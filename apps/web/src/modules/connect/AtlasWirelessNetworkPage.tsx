import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getWirelessNetworkInventory,
  type WirelessNetworkInventory
} from '../../lib/wirelessNetworkApi';

export function AtlasWirelessNetworkPage() {
  const [state, setState] = useState<WirelessNetworkInventory | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getWirelessNetworkInventory()
      .then((next) => {
        if (!active) return;
        setState(next);
        setError('');
      })
      .catch((reason) => {
        if (!active) return;
        setState(null);
        setError(reason instanceof Error ? reason.message : 'network_inventory_unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  const blockers = state?.blockers ?? [error || 'network_inventory_unavailable'];

  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-network-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless Department</p>
        <h1 id="atlas-wireless-network-title">ATLAS-Owned Network</h1>
        <p>Governed inventory and readiness for ATLAS core, RAN, spectrum and backhaul. Physical infrastructure is never inferred from configuration alone.</p>
      </header>

      <div className="stat-grid" aria-label="ATLAS owned-network readiness">
        <article>
          <strong>{state?.profile_configured ? state.network_mode : 'Unconfigured'}</strong>
          <span>network mode</span>
        </article>
        <article>
          <strong>{state?.lab_ready ? 'Ready' : 'Blocked'}</strong>
          <span>private lab gate</span>
        </article>
        <article>
          <strong>{state?.technical_public_ready ? 'Ready' : 'Blocked'}</strong>
          <span>technical public-network gate</span>
        </article>
      </div>

      <div className="notice" role="status">
        {state
          ? `ATLAS server gate checked ${state.checked_at}. Public commercial activation still requires the separate launch-authorization gate.`
          : 'Authenticated network inventory is unavailable. All owned-network readiness remains fail-closed.'}
      </div>

      <article className="feature-card">
        <p className="eyebrow">Current blockers</p>
        <h2>{blockers.length ? `${blockers.length} unresolved gate(s)` : 'No technical blockers reported'}</h2>
        <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
      </article>

      <div className="module-grid">
        <article className="feature-card">
          <p className="eyebrow">RAN</p>
          <h2>{state?.inventory.ran_sites.length ?? 0} site(s)</h2>
          <p>Only authenticated organization-scoped inventory is counted.</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Spectrum</p>
          <h2>{state?.inventory.spectrum_authorizations.length ?? 0} authorization record(s)</h2>
          <p>No spectrum record becomes ready without evidence and freshness checks.</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Backhaul</p>
          <h2>{state?.inventory.backhaul_links.length ?? 0} link(s)</h2>
          <p>Fiber, Ethernet, microwave, fixed wireless and satellite are modeled explicitly.</p>
        </article>
      </div>

      <div className="row-actions">
        <Link className="text-link" to="/connect/wireless/mvno">Open MVNO control</Link>
        <Link className="text-link" to="/connect/wireless">Back to ATLAS Wireless</Link>
      </div>
    </section>
  );
}
