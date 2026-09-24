import { useEffect, useMemo, useState } from 'react';
import {
  actionAvailability,
  ecologyActionAvailability,
  expansionActionAvailability,
  survivalActionAvailability,
  FRONTIER_ACTIONS,
  FRONTIER_CAMPAIGN,
  FRONTIER_ECOLOGY_ACTIONS,
  FRONTIER_EXPANSION_ACTIONS,
  FRONTIER_SURVIVAL_ACTIONS,
  frontierCampaignProgress,
  frontierCurrentLevel,
  frontierExplorerRank,
  frontierObjective,
  INITIAL_FRONTIER_ECOLOGY_STATE,
  INITIAL_FRONTIER_EXPANSION_STATE,
  INITIAL_FRONTIER_SURVIVAL_STATE,
  INITIAL_FRONTIER_STATE,
  type FrontierActionId,
  type FrontierEcologyActionId,
  type FrontierEcologyState,
  type FrontierExpansionActionId,
  type FrontierExpansionState,
  type FrontierSurvivalActionId,
  type FrontierSurvivalState,
  type FrontierState
} from './domain';
import {
  buildFrontierHabitat,
  discoverFrontierCodexEntry,
  executeFrontierAction,
  executeFrontierEcologyAction,
  executeFrontierExpansionAction,
  executeFrontierSurvivalAction,
  loadFrontierCodexDiscoveries,
  loadFrontierEcology,
  loadFrontierExpansion,
  loadFrontierRun,
  loadFrontierStructures,
  loadFrontierSurvival,
  loadFrontierWorldPresence,
  transitionFrontierBiome
} from './api';
import { FrontierCodex } from './FrontierCodex';
import { FrontierWorld3D } from './FrontierWorld3D';
import type { FrontierStructure, WorldPlacement } from './world3d';
import {
  INITIAL_FRONTIER_WORLD_PRESENCE,
  type FrontierBiomeRegion,
  type FrontierWorldPoint,
  type FrontierWorldPresence
} from './biomes';
import './frontier.css';

type RuntimeState = 'loading' | 'ready' | 'saving' | 'blocked';

function createActionKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `frontier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function FrontierRoutes() {
  const [state, setState] = useState<FrontierState>({ ...INITIAL_FRONTIER_STATE });
  const [ecology, setEcology] = useState<FrontierEcologyState>({ ...INITIAL_FRONTIER_ECOLOGY_STATE });
  const [expansion, setExpansion] = useState<FrontierExpansionState>({ ...INITIAL_FRONTIER_EXPANSION_STATE });
  const [survival, setSurvival] = useState<FrontierSurvivalState>({ ...INITIAL_FRONTIER_SURVIVAL_STATE });
  const [runtime, setRuntime] = useState<RuntimeState>('loading');
  const [message, setMessage] = useState('Connecting to governed FRONTIER state…');
  const [buildMode, setBuildMode] = useState(false);
  const [structures, setStructures] = useState<FrontierStructure[]>([]);
  const [codexDiscoveries, setCodexDiscoveries] = useState<Set<string>>(() => new Set());
  const [worldPresence, setWorldPresence] = useState<FrontierWorldPresence>({
    position: { ...INITIAL_FRONTIER_WORLD_PRESENCE.position },
    biomeEntryId: INITIAL_FRONTIER_WORLD_PRESENCE.biomeEntryId,
    revision: INITIAL_FRONTIER_WORLD_PRESENCE.revision
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loaded, loadedStructures, loadedEcology, loadedExpansion, loadedSurvival, loadedDiscoveries, loadedPresence] = await Promise.all([
          loadFrontierRun(),
          loadFrontierStructures(),
          loadFrontierEcology(),
          loadFrontierExpansion(),
          loadFrontierSurvival(),
          loadFrontierCodexDiscoveries(),
          loadFrontierWorldPresence()
        ]);
        if (cancelled) return;
        setState(loaded);
        setStructures(loadedStructures);
        setEcology(loadedEcology);
        setExpansion(loadedExpansion);
        setSurvival(loadedSurvival);
        setCodexDiscoveries(new Set(loadedDiscoveries));
        setWorldPresence(loadedPresence);
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

  const objective = useMemo(() => frontierObjective(state, ecology, expansion), [state, ecology, expansion]);
  const missionProgress = useMemo(() => frontierCampaignProgress(state, ecology, expansion), [state, ecology, expansion]);
  const currentLevel = useMemo(() => frontierCurrentLevel(state, ecology, expansion), [state, ecology, expansion]);
  const explorerRank = useMemo(() => frontierExplorerRank(state), [state]);
  const activeMission = FRONTIER_CAMPAIGN.find((mission) => mission.stage === state.campaignStage) ?? FRONTIER_CAMPAIGN[0];
  const expansionActions = FRONTIER_EXPANSION_ACTIONS.filter((action) => action.stage === state.campaignStage);

  const expansionMetrics = useMemo(() => {
    if (state.campaignStage === 6) return [
      ['Storm Charge', `${expansion.stormCharge}%`],
      ['Shelter', `${expansion.shelterIntegrity}%`],
      ['Storm Mastery', `${expansion.stormMastery}%`]
    ];
    if (state.campaignStage === 7) return [
      ['Settlements', String(expansion.settlements)],
      ['Civic Links', String(expansion.civicLinks)],
      ['Civilization', `${expansion.civilizationIndex}%`]
    ];
    if (state.campaignStage === 8) return [
      ['Orbital Frames', String(expansion.orbitalFrames)],
      ['Stations', String(expansion.orbitalStations)],
      ['Orbital Reach', `${expansion.orbitalReach}%`]
    ];
    if (state.campaignStage === 9) return [
      ['Network Links', String(expansion.networkLinks)],
      ['Trade Volume', `${expansion.tradeVolume}%`],
      ['Network Integrity', `${expansion.networkIntegrity}%`]
    ];
    return [
      ['World Seeds', String(expansion.worldSeeds)],
      ['Worlds Generated', String(expansion.worldsGenerated)],
      ['Infinite Mastery', `${expansion.infiniteMastery}%`],
      ['Endless Cycles', String(expansion.endlessCycles)]
    ];
  }, [state.campaignStage, expansion]);

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
      setMessage(next.campaignStage >= 5
        ? 'Core progression committed. Advanced campaign systems remain governed by their dedicated controllers.'
        : 'Action committed, audited and campaign progress recalculated.');
      return true;
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Flow Controller rejected the action.');
      return false;
    }
  };

  const runEcologyAction = async (action: FrontierEcologyActionId) => {
    if (runtime !== 'ready') return;
    const availability = ecologyActionAvailability(state, ecology, action);
    if (!availability.enabled) {
      setMessage(availability.reason || 'Living-world action unavailable.');
      return;
    }

    setRuntime('saving');
    setMessage('Living Systems Controller validating biome state, resources, organization, permission and idempotency…');
    try {
      const next = await executeFrontierEcologyAction(action, createActionKey());
      setState(next.state);
      setEcology(next.ecology);
      setRuntime('ready');
      setMessage(next.state.campaignStage >= 6
        ? 'First biome restored. Tormenta iónica unlocked.'
        : 'Ecology action committed and audited.');
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Living Systems Controller rejected the action.');
    }
  };

  const runExpansionAction = async (action: FrontierExpansionActionId) => {
    if (runtime !== 'ready') return;
    const availability = expansionActionAvailability(state, expansion, action);
    if (!availability.enabled) {
      setMessage(availability.reason || 'Campaign expansion action unavailable.');
      return;
    }

    setRuntime('saving');
    setMessage('Campaign Controller validating exact phase, resources, permissions, progression and idempotency…');
    try {
      const next = await executeFrontierExpansionAction(action, createActionKey());
      setState(next.state);
      setExpansion(next.expansion);
      setRuntime('ready');
      setMessage(next.expansion.campaignComplete
        ? `ATLAS Infinite campaign spine complete · Endless cycle ${next.expansion.endlessCycles} recorded.`
        : `Phase ${next.state.campaignStage} progression committed and audited.`);
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Campaign Controller rejected the action.');
    }
  };

  const runSurvivalAction = async (action: FrontierSurvivalActionId) => {
    if (runtime !== 'ready') return;
    const availability = survivalActionAvailability(state, survival, action);
    if (!availability.enabled) {
      setMessage(availability.reason || 'Survival action unavailable.');
      return;
    }

    setRuntime('saving');
    setMessage('Survival Controller validating hazard state, protection, resources, organization and idempotency…');
    try {
      const next = await executeFrontierSurvivalAction(action, createActionKey());
      setState(next.state);
      setSurvival(next.survival);
      setRuntime('ready');
      if (next.survival.health <= 0) {
        setMessage('Explorer incapacitated. Recovery at a governed Habitat is required.');
      } else if (next.survival.activeHazard === 'clear') {
        setMessage(`Survival state committed · ${next.survival.survivedEvents} environmental event${next.survival.survivedEvents === 1 ? '' : 's'} survived.`);
      } else {
        setMessage(`${next.survival.activeHazard.replace('_', ' ')} active · ${next.survival.hazardTurns} turn${next.survival.hazardTurns === 1 ? '' : 's'} remaining.`);
      }
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Survival Controller rejected the action.');
    }
  };

  const discoverCodexEntry = async (entryId: string) => {
    if (runtime !== 'ready') return;
    setRuntime('saving');
    setMessage('Codex Controller validating campaign stage, organization and discovery access…');
    try {
      const discoveredId = await discoverFrontierCodexEntry(entryId);
      setCodexDiscoveries((current) => {
        const next = new Set(current);
        next.add(discoveredId);
        return next;
      });
      setRuntime('ready');
      setMessage('Codex discovery persisted to the governed world record.');
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'Codex Controller rejected the discovery.');
    }
  };

  const transitionBiome = async (biome: FrontierBiomeRegion, position: FrontierWorldPoint) => {
    if (runtime !== 'ready') return false;
    setRuntime('saving');
    setMessage(`Biome Controller validating ${biome.label}, campaign phase, organization, coordinates and idempotency…`);
    try {
      const presence = await transitionFrontierBiome(biome.entryId, position, createActionKey());
      setWorldPresence(presence);
      setCodexDiscoveries((current) => {
        const next = new Set(current);
        next.add(presence.biomeEntryId);
        return next;
      });
      setRuntime('ready');
      setMessage(`${biome.label} entered and persisted. Codex discovery and traversal audit committed atomically.`);
      return true;
    } catch (error) {
      setRuntime('ready');
      setMessage(error instanceof Error ? error.message : 'Biome Controller rejected the transition.');
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
      const [loaded, loadedStructures, loadedEcology, loadedExpansion, loadedSurvival, loadedDiscoveries, loadedPresence] = await Promise.all([
        loadFrontierRun(),
        loadFrontierStructures(),
        loadFrontierEcology(),
        loadFrontierExpansion(),
        loadFrontierSurvival(),
        loadFrontierCodexDiscoveries(),
        loadFrontierWorldPresence()
      ]);
      setState(loaded);
      setStructures(loadedStructures);
      setEcology(loadedEcology);
      setExpansion(loadedExpansion);
      setSurvival(loadedSurvival);
      setCodexDiscoveries(new Set(loadedDiscoveries));
      setWorldPresence(loadedPresence);
      setRuntime('ready');
      setMessage(`Governed world synchronized · ${loadedStructures.length} persistent structure${loadedStructures.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setRuntime('blocked');
      setMessage(error instanceof Error ? error.message : 'FRONTIER persistence unavailable.');
    }
  };

  return (
    <section className="frontier-page page-stack" data-hazard={survival.activeHazard}>
      <header className="frontier-hero">
        <div>
          <p className="eyebrow">ATLAS · FRONTIER</p>
          <h1>{expansion.campaignComplete ? 'Atlas Infinite' : 'Restore the Sky Grid'}</h1>
          <p>Governed 40-level sandbox campaign: survive, build, cultivate, civilize, reach orbit, connect worlds and generate new frontiers.</p>
        </div>
        <div className="frontier-runtime" data-state={runtime}>
          <span className="frontier-runtime-dot" />
          <div><strong>{runtime === 'ready' ? 'FLOW READY' : runtime === 'saving' ? 'COMMITTING' : runtime === 'loading' ? 'SYNCING' : 'FAIL-CLOSED'}</strong><small>Revision {state.revision}</small></div>
        </div>
      </header>

      <div className="frontier-objective">
        <div>
          <span>PHASE {state.campaignStage} · {activeMission.title.toUpperCase()}</span>
          <strong>{objective}</strong>
        </div>
        <div><span>LEVEL</span><strong>{currentLevel.level}/40 · {currentLevel.title}</strong></div>
        <div><span>EXPLORER RANK</span><strong>{explorerRank}</strong></div>
        <div><span>EXPERIENCE</span><strong>{state.experience} XP</strong></div>
        <div><span>HEALTH</span><strong>{survival.health}%</strong></div>
        <div><span>ION CLOCK</span><strong>{String(state.stormMinutes).padStart(2, '0')}:00</strong></div>
      </div>

      <div className="frontier-campaign" aria-label="ATLAS FRONTIER campaign progression">
        <div className="frontier-campaign-head">
          <div><span>40-LEVEL CAMPAIGN</span><strong>{missionProgress}% current phase</strong></div>
          <div className="frontier-campaign-progress"><i style={{ width: `${missionProgress}%` }} /></div>
        </div>
        <div className="frontier-campaign-grid">
          {FRONTIER_CAMPAIGN.map((mission) => {
            const status = state.campaignStage > mission.stage ? 'complete' : state.campaignStage === mission.stage ? 'active' : 'locked';
            return (
              <article key={mission.stage} data-status={status}>
                <span>{String(mission.stage).padStart(2, '0')} · {status === 'complete' ? 'COMPLETE' : status === 'active' ? 'ACTIVE' : 'LOCKED'}</span>
                <strong>{mission.title}</strong>
                <p>{mission.summary}</p>
              </article>
            );
          })}
        </div>
      </div>

      {expansion.campaignComplete ? (
        <div className="frontier-complete" role="status">
          <div><span>CAMPAIGN SPINE COMPLETE</span><strong>40 / 40 · ATLAS INFINITE</strong></div>
          <p>The first full restoration cycle is verified. Endless mode remains active: synthesize a World Seed, generate another world and restore it again.</p>
        </div>
      ) : null}

      <div className="frontier-layout">
        <FrontierWorld3D
          state={state}
          structures={structures}
          runtimeReady={runtime === 'ready'}
          initialPosition={worldPresence.position}
          buildMode={buildMode}
          onBuildModeChange={setBuildMode}
          onAction={runAction}
          onBuildHabitat={buildHabitat}
          onBiomeTransition={transitionBiome}
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

          <section className="frontier-survival" data-hazard={survival.activeHazard} aria-label="Survival and dynamic environment">
            <div className="frontier-survival-heading">
              <div><span>SURVIVAL SYSTEMS</span><strong>{survival.activeHazard === 'clear' ? 'Environment stable' : survival.activeHazard.replace('_', ' ')}</strong></div>
              <small>{survival.survivedEvents} survived</small>
            </div>
            <div className="frontier-survival-stats">
              <article><span>Health</span><strong>{survival.health}%</strong></article>
              <article><span>Suit Energy</span><strong>{survival.suitEnergy}%</strong></article>
              <article><span>Shield</span><strong>{survival.shieldIntegrity}%</strong></article>
              <article><span>Thermal</span><strong>{survival.thermalStability}%</strong></article>
              <article><span>Exposure</span><strong>{survival.exposure}%</strong></article>
              <article><span>Hazard</span><strong>{survival.hazardIntensity}% · {survival.hazardTurns}T</strong></article>
            </div>
            <div className="frontier-survival-actions">
              {FRONTIER_SURVIVAL_ACTIONS.map((action) => {
                const availability = survivalActionAvailability(state, survival, action.id);
                const disabled = runtime !== 'ready' || !availability.enabled;
                return (
                  <button key={action.id} type="button" disabled={disabled} onClick={() => void runSurvivalAction(action.id)}>
                    <span>{action.mode}</span>
                    <strong>{action.label}</strong>
                    <small>{availability.enabled ? action.description : availability.reason}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="frontier-ecology" aria-label="Living Worlds systems">
            <div className="frontier-ecology-heading">
              <div><span>LIVING SYSTEMS</span><strong>Mundos vivos</strong></div>
              <small>{ecology.ecosystemStability}% stable</small>
            </div>
            <div className="frontier-ecology-meter"><i style={{ width: `${ecology.ecosystemStability}%` }} /></div>
            <div className="frontier-ecology-stats">
              <article><span>Seed Pods</span><strong>{ecology.seedPods}</strong></article>
              <article><span>Living Plots</span><strong>{ecology.cultivatedPlots}</strong></article>
              <article><span>Eco Energy</span><strong>{ecology.ecoEnergy}</strong></article>
              <article><span>Biomes</span><strong>{ecology.restoredBiomes}</strong></article>
            </div>
            <div className="frontier-ecology-actions">
              {FRONTIER_ECOLOGY_ACTIONS.map((action) => {
                const availability = ecologyActionAvailability(state, ecology, action.id);
                const disabled = runtime !== 'ready' || !availability.enabled;
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void runEcologyAction(action.id)}
                  >
                    <span>{action.mode}</span>
                    <strong>{action.label}</strong>
                    <small>{availability.enabled ? action.description : availability.reason}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {state.campaignStage >= 6 ? (
            <section className="frontier-expansion" data-stage={state.campaignStage} aria-label="Advanced campaign systems">
              <div className="frontier-expansion-heading">
                <div><span>ADVANCED CAMPAIGN</span><strong>{activeMission.title}</strong></div>
                <small>Phase {state.campaignStage}/10</small>
              </div>
              <div className="frontier-expansion-stats">
                {expansionMetrics.map(([label, value]) => (
                  <article key={label}><span>{label}</span><strong>{value}</strong></article>
                ))}
              </div>
              <div className="frontier-expansion-actions">
                {expansionActions.map((action) => {
                  const availability = expansionActionAvailability(state, expansion, action.id);
                  const disabled = runtime !== 'ready' || !availability.enabled;
                  return (
                    <button key={action.id} type="button" disabled={disabled} onClick={() => void runExpansionAction(action.id)}>
                      <span>{action.mode}</span>
                      <strong>{action.label}</strong>
                      <small>{availability.enabled ? action.description : availability.reason}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <FrontierCodex
        campaignStage={state.campaignStage}
        discoveredIds={codexDiscoveries}
        runtimeReady={runtime === 'ready'}
        onDiscover={discoverCodexEntry}
      />

      <div className={runtime === 'blocked' ? 'frontier-status frontier-status-error' : 'frontier-status'} role="status" aria-live="polite">
        <div><strong>{runtime === 'blocked' ? 'Execution blocked' : 'Governed run'}</strong><span>{message}</span></div>
        {runtime === 'blocked' ? <button type="button" onClick={() => void recover()}>Retry controller</button> : null}
      </div>

      <div className="frontier-governance">
        <article><span>Identity</span><strong>Organization scoped</strong><p>ATLAS Identity and active organization membership are required before this route opens.</p></article>
        <article><span>Controllers</span><strong>Server authoritative</strong><p>Core, spatial, ecology, survival and phases 6-10 validate progression, hazards, resources and idempotency transactionally in Supabase.</p></article>
        <article><span>Audit</span><strong>Append-only evidence</strong><p>World structures, ecology, survival hazards, campaign actions and Codex discoveries retain durable governed evidence.</p></article>
      </div>
    </section>
  );
}
