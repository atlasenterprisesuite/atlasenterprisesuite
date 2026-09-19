import { useEffect, useMemo, useState } from 'react';
import {
  actionAvailability,
  FRONTIER_ACTIONS,
  FRONTIER_CAMPAIGN,
  frontierCampaignProgress,
  frontierExplorerRank,
  frontierObjective,
  INITIAL_FRONTIER_STATE,
  type FrontierActionId,
  type FrontierState
} from './domain';
import { buildFrontierHabitat, executeFrontierAction, loadFrontierRun, loadFrontierStructures } from './api';
import { FrontierWorld3D } from './FrontierWorld3D';
import type { FrontierStructure, WorldPlacement } from './world3d';
import './frontier.css';

type RuntimeState = 'loading' | 'ready' | 'saving' | 'blocked';

function createActionKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `frontier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function FrontierRoutes() {
  const [state, setState] = useState<FrontierState>({ ...INITIAL_FRONTIER_STATE });
  const [runtime, setRuntime] = useState<RuntimeState>('loading');
  const [message, setMessage] = useState('Connecting to governed FRONTIER state…');
  const [buildMode, setBuildMode] = useState(false);
  const [structures, setStructures] = useState<FrontierStructure[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loaded, loadedStructures] = await Promise.all([
          loadFrontierRun(),
          loadFrontierStructures()
        ]);
        if (cancelled) return;
        setState(loaded);
        setStructures(loadedStructures);
        setRuntime('ready');
        setMessage(loaded.revision > 0
          ? `Saved world loaded: revision ${loaded.revision} · ${loadedStructures.length} persistent structure${loadedStructures.length === 1 ? '' : 's'}.`
          : 'New governed run ready.');
      } catch (error) {
        if (cancelled) return;
        setRuntime('blocked');
        setMessage(error instanceof Error ? error.message : 'FRONTIER persistence unavailable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const objective = useMemo(() => frontierObjective(state), [state]);
  const missionProgress = useMemo(() => frontierCampaignProgress(state), [state]);
  const explorerRank = useMemo(() => frontierExplorerRank(state), [state]);
  const activeMission = FRONTIER_CAMPAIGN.find((mission) => mission.stage === state.campaignStage) ?? FRONTIER_CAMPAIGN[0];

  const runAction = async (action: FrontierActionId) => {
    if (runtime !== 'ready') return false;
    const availability = actionAvailability(state, action);
    if (!availability.enabled) {
      setMessage(availability.reason || 'Action unavailable.');
      return false;
    }
    setRuntime('saving');
    setMessage('Flow Controller validating campaign stage, organization, permission, resources and idempotency…');
    try {
      const next = await executeFrontierAction(action, createActionKey());
      setState(next);
      setRuntime('ready');
      setMessage(next.campaignStage >= 5 ? 'Awakening campaign complete. Mundos vivos remains gated for the next production phase.' : 'Action committed, audited and campaign progress recalculated.');
      return true;
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Flow Controller rejected the action.');
      return false;
    }
  };

  const buildHabitat = async (placement: WorldPlacement) => {
    if (runtime !== 'ready') return false;
    const availability = actionAvailability(state, 'build_habitat');
    if (!availability.enabled) {
      setMessage(availability.reason || 'Habitat build unavailable.');
      return false;
    }

    setRuntime('saving');
    setMessage('Flow Controller validating resources, spatial bounds, collisions, audit and idempotency…');
    try {
      const result = await buildFrontierHabitat(placement, createActionKey());
      setState(result.state);
      setStructures((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== result.structure.id);
        return [...withoutDuplicate, result.structure];
      });
      setRuntime('ready');
      setMessage('Habitat committed with durable coordinates. This world position will be restored on the next session.');
      return true;
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Spatial Flow Controller rejected the build.');
      return false;
    }
  };

  const recover = async () => {
    setRuntime('loading');
    setMessage('Rechecking governed persistence…');
    try {
      const [loaded, loadedStructures] = await Promise.all([
        loadFrontierRun(),
        loadFrontierStructures()
      ]);
      setState(loaded);
      setStructures(loadedStructures);
      setRuntime('ready');
      setMessage(`Governed world synchronized · ${loadedStructures.length} persistent structure${loadedStructures.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'FRONTIER persistence unavailable.');
    }
  };

  return (
    <section className="frontier-page page-stack">
      <header className="frontier-hero">
        <div>
          <p className="eyebrow">ATLAS · FRONTIER</p>
          <h1>Restore the Sky Grid</h1>
          <p>Governed sandbox campaign: explore, extract, build, craft and restore. Server-side rules remain authoritative.</p>
        </div>
        <div className="frontier-runtime" data-state={runtime}>
          <span className="frontier-runtime-dot" />
          <div><strong>{runtime === 'ready' ? 'FLOW READY' : runtime === 'saving' ? 'COMMITTING' : runtime === 'loading' ? 'SYNCING' : 'FAIL-CLOSED'}</strong><small>Revision {state.revision}</small></div>
        </div>
      </header>

      <div className="frontier-objective">
        <div>
          <span>MISSION {state.campaignStage} · {activeMission.title.toUpperCase()}</span>
          <strong>{objective}</strong>
        </div>
        <div><span>EXPLORER RANK</span><strong>{explorerRank}</strong></div>
        <div><span>EXPERIENCE</span><strong>{state.experience} XP</strong></div>
        <div><span>ION STORM</span><strong>{String(state.stormMinutes).padStart(2, '0')}:00</strong></div>
      </div>

      <div className="frontier-campaign" aria-label="ATLAS FRONTIER campaign progression">
        <div className="frontier-campaign-head">
          <div><span>AWAKENING CAMPAIGN</span><strong>{missionProgress}% current mission</strong></div>
          <div className="frontier-campaign-progress"><i style={{ width: `${missionProgress}%` }} /></div>
        </div>
        <div className="frontier-campaign-grid">
          {FRONTIER_CAMPAIGN.map((mission) => {
            const status = state.campaignStage > mission.stage ? 'complete' : state.campaignStage === mission.stage ? 'active' : 'locked';
            return (
              <article key={mission.stage} data-status={status}>
                <span>{String(mission.stage).padStart(2, '0')} · {status === 'complete' ? 'COMPLETE' : status === 'active' ? 'ACTIVE' : mission.productionState === 'next' ? 'NEXT PHASE' : 'LOCKED'}</span>
                <strong>{mission.title}</strong>
                <p>{mission.summary}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="frontier-layout">
        <FrontierWorld3D
          state={state}
          structures={structures}
          runtimeReady={runtime === 'ready'}
          buildMode={buildMode}
          onBuildModeChange={setBuildMode}
          onAction={runAction}
          onBuildHabitat={buildHabitat}
          onMessage={setMessage}
        />

        <aside className="frontier-panel">
          <div className="frontier-resources">
            <article><span>Aetherium</span><strong>{state.aetherium}</strong></article>
            <article><span>Alloy</span><strong>{state.alloy}</strong></article>
            <article><span>Biofiber</span><strong>{state.biofiber}</strong></article>
            <article><span>Power Cores</span><strong>{state.powerCores}</strong></article>
          </div>

          <div className="frontier-actions">
            {FRONTIER_ACTIONS.map((action) => {
              const availability = actionAvailability(state, action.id);
              const disabled = runtime !== 'ready' || !availability.enabled;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (action.id === 'build_habitat') {
                      setBuildMode(true);
                      setMessage('Build mode enabled. Choose a placement point in the 3D world and confirm.');
                      return;
                    }
                    void runAction(action.id);
                  }}
                >
                  <span>{action.mode}</span>
                  <strong>{action.label}</strong>
                  <small>{availability.enabled ? action.description : availability.reason}</small>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <div className={runtime === 'blocked' ? 'frontier-status frontier-status-error' : 'frontier-status'} role="status" aria-live="polite">
        <div><strong>{runtime === 'blocked' ? 'Execution blocked' : 'Governed run'}</strong><span>{message}</span></div>
        {runtime === 'blocked' ? <button type="button" onClick={() => void recover()}>Retry controller</button> : null}
      </div>

      <div className="frontier-governance">
        <article><span>Identity</span><strong>Organization scoped</strong><p>ATLAS Identity and active organization membership are required before this route opens.</p></article>
        <article><span>Controller</span><strong>Server authoritative</strong><p>Mission gates, resource costs and progression are validated transactionally in Supabase, not trusted to the browser.</p></article>
        <article><span>Audit</span><strong>Append-only events</strong><p>Every committed action records before/after state, campaign stage and an idempotency key.</p></article>
      </div>
    </section>
  );
}
