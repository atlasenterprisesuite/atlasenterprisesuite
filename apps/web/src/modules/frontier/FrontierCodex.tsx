import { useMemo, useState } from 'react';
import {
  FRONTIER_CODEX,
  FRONTIER_CODEX_CATEGORIES,
  FRONTIER_ORIGIN,
  codexCompletion,
  type FrontierCodexCategory
} from './codex';

type Props = {
  campaignStage: number;
  discoveredIds: ReadonlySet<string>;
  runtimeReady: boolean;
  onDiscover: (entryId: string) => Promise<void>;
};

export function FrontierCodex({ campaignStage, discoveredIds, runtimeReady, onDiscover }: Props) {
  const [category, setCategory] = useState<FrontierCodexCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(
    () => FRONTIER_CODEX.filter((entry) => category === 'all' || entry.category === category),
    [category]
  );
  const completion = codexCompletion(campaignStage, discoveredIds);

  return (
    <section className="frontier-codex" aria-label="ATLAS FRONTIER Codex">
      <div className="frontier-codex-header">
        <div>
          <span>WORLD CODEX</span>
          <strong>{FRONTIER_ORIGIN.title}</strong>
          <p>{FRONTIER_ORIGIN.summary}</p>
        </div>
        <div className="frontier-codex-completion">
          <span>DISCOVERED</span>
          <strong>{completion}%</strong>
        </div>
      </div>

      <div className="frontier-codex-tabs" role="tablist" aria-label="Codex categories">
        <button type="button" data-active={category === 'all'} onClick={() => setCategory('all')}>All</button>
        {FRONTIER_CODEX_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            data-active={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="frontier-codex-grid">
        {visible.map((entry) => {
          const stageUnlocked = entry.requiredStage <= campaignStage;
          const discovered = discoveredIds.has(entry.id);
          const expanded = expandedId === entry.id;
          return (
            <article key={entry.id} data-state={!stageUnlocked ? 'locked' : discovered ? 'discovered' : 'available'}>
              <div className="frontier-codex-entry-top">
                <span>{entry.category.toUpperCase()} · PHASE {entry.requiredStage}</span>
                <small>{!stageUnlocked ? 'LOCKED' : discovered ? 'DISCOVERED' : 'AVAILABLE'}</small>
              </div>
              <strong>{stageUnlocked ? entry.title : 'Encrypted Entry'}</strong>
              <p>{stageUnlocked ? entry.summary : `Reach campaign phase ${entry.requiredStage} to unlock this record.`}</p>
              {stageUnlocked && discovered && expanded ? <p className="frontier-codex-detail">{entry.detail}</p> : null}
              <div className="frontier-codex-entry-actions">
                {stageUnlocked && !discovered ? (
                  <button type="button" disabled={!runtimeReady} onClick={() => void onDiscover(entry.id)}>
                    Discover
                  </button>
                ) : null}
                {discovered ? (
                  <button type="button" onClick={() => setExpandedId(expanded ? null : entry.id)}>
                    {expanded ? 'Collapse' : 'Open record'}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
