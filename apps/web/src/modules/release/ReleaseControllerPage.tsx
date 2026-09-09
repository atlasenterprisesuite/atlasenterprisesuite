import { useEffect, useMemo, useState } from 'react';
import type { ReleaseQueueRecord } from '../../../../../packages/release-control/src';
import { useReleaseControl } from './ReleaseControlProvider';

type ReleaseViewState =
  | { status: 'pending_replay' }
  | { status: 'loading' }
  | { status: 'operator_required' }
  | { status: 'unavailable'; message: string }
  | { status: 'ready'; queue: ReleaseQueueRecord[] };

export function ReleaseControllerPage() {
  const service = useReleaseControl();
  const [state, setState] = useState<ReleaseViewState>(
    service ? { status: 'loading' } : { status: 'pending_replay' },
  );

  useEffect(() => {
    if (!service) {
      setState({ status: 'pending_replay' });
      return;
    }

    let active = true;
    const load = async () => {
      setState({ status: 'loading' });
      try {
        const operator = await service.isOperator();
        if (!active) return;
        if (!operator) {
          setState({ status: 'operator_required' });
          return;
        }
        const queue = await service.listQueue();
        if (active) setState({ status: 'ready', queue });
      } catch (error) {
        if (!active) return;
        setState({
          status: 'unavailable',
          message: error instanceof Error ? error.message : 'Release registry is unavailable',
        });
      }
    };

    void load();
    return () => { active = false; };
  }, [service]);

  const waves = useMemo(() => {
    if (state.status !== 'ready') return [] as Array<[number, ReleaseQueueRecord[]]>;
    const grouped = new Map<number, ReleaseQueueRecord[]>();
    for (const item of state.queue) {
      const items = grouped.get(item.releaseWave) ?? [];
      items.push(item);
      grouped.set(item.releaseWave, items);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [state]);

  return (
    <main className="atlas-page atlas-module-page release-controller-page">
      <p className="atlas-eyebrow">ATLAS Manager / Release Train</p>
      <h1>ATLAS Release Controller</h1>
      <p className="atlas-page__lede">
        Read-only release-train visibility while the activation registry is being replayed and verified. Development can continue in parallel; production activation remains locked.
      </p>

      {state.status === 'pending_replay' && (
        <div className="atlas-card-grid">
          <article className="atlas-status-panel atlas-status-panel--degraded">
            <strong>Registry</strong>
            <span>Release registry: Pending replay</span>
          </article>
          <article className="atlas-status-panel atlas-status-panel--degraded">
            <strong>Production</strong>
            <span>Production activation: Locked</span>
          </article>
        </div>
      )}

      {state.status === 'loading' && (
        <section className="atlas-status-panel">
          <strong>Release registry</strong>
          <span>Loading governed queue…</span>
        </section>
      )}

      {state.status === 'operator_required' && (
        <section className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Release operator</strong>
          <span>Release operator authorization: Required</span>
        </section>
      )}

      {state.status === 'unavailable' && (
        <div className="atlas-card-grid">
          <article className="atlas-status-panel atlas-status-panel--degraded">
            <strong>Registry</strong>
            <span>Release registry: Pending replay</span>
          </article>
          <article className="atlas-status-panel atlas-status-panel--degraded">
            <strong>Production</strong>
            <span>Production activation: Locked</span>
          </article>
          <article className="atlas-status-panel atlas-status-panel--degraded" role="alert">
            <strong>Backend detail</strong>
            <span>{state.message}</span>
          </article>
        </div>
      )}

      {state.status === 'ready' && waves.map(([wave, records]) => (
        <section className="atlas-status-panel" key={wave}>
          <strong>Wave {wave}</strong>
          <div className="atlas-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Development</th>
                  <th>Release</th>
                  <th>CI</th>
                  <th>Migration</th>
                  <th>Provider</th>
                  <th>Production</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.moduleCode}>
                    <td>{record.moduleCode}</td>
                    <td>{record.developmentException ?? record.developmentStatus}</td>
                    <td>{record.exceptionState ?? record.lifecycleStatus ?? 'not queued'}</td>
                    <td>{record.ciStatus ?? 'pending'}</td>
                    <td>{record.migrationStatus ?? 'pending'}</td>
                    <td>{record.providerStatus ?? 'pending'}</td>
                    <td>{record.productionVerified ? 'verified' : record.activationEnabled ? 'live / unverified' : 'inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
