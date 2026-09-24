import { useMemo, useState } from 'react';
import type { GalaxyCategory, GalaxyNodeView } from './galaxyModel';

type GalaxyFilter = 'all' | GalaxyCategory;

const FILTERS: readonly { id: GalaxyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'financial', label: 'Financial' },
  { id: 'operations', label: 'Operations' },
  { id: 'security', label: 'Security' }
];

export function AtlasGalaxyMap({
  nodes,
  onSelectNode
}: {
  nodes: readonly GalaxyNodeView[];
  onSelectNode: (node: GalaxyNodeView) => void;
}) {
  const [filter, setFilter] = useState<GalaxyFilter>('all');

  const visibleNodes = useMemo(
    () => filter === 'all' ? nodes : nodes.filter((node) => node.category === filter),
    [filter, nodes]
  );

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(() => visibleNodes.flatMap((node) =>
    node.dependencies
      .filter((dependencyId) => visibleIds.has(dependencyId))
      .map((dependencyId) => {
        const target = visibleNodes.find((candidate) => candidate.id === dependencyId);
        return target ? { source: node, target } : null;
      })
      .filter((edge): edge is { source: GalaxyNodeView; target: GalaxyNodeView } => Boolean(edge))
  ), [visibleIds, visibleNodes]);

  return (
    <section className="galaxy-map" aria-labelledby="atlas-galaxy-title">
      <header className="galaxy-toolbar">
        <div>
          <p className="galaxy-eyebrow">Spatial navigation</p>
          <h2 id="atlas-galaxy-title">ATLAS Galaxy Map</h2>
          <p className="galaxy-subtitle">Interconnected ATLAS modules with registry-backed readiness state.</p>
        </div>
        <div className="galaxy-filters" aria-label="Galaxy category filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              className="galaxy-filter"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="galaxy-canvas">
        <div className="galaxy-nebula" aria-hidden="true" />
        <svg className="galaxy-connections" aria-hidden="true" focusable="false">
          {visibleEdges.map(({ source, target }) => (
            <line
              key={`${source.id}-${target.id}`}
              x1={`${source.coordinates.x}%`}
              y1={`${source.coordinates.y}%`}
              x2={`${target.coordinates.x}%`}
              y2={`${target.coordinates.y}%`}
            />
          ))}
        </svg>

        {visibleNodes.length === 0 ? (
          <div className="galaxy-empty">No modules match this filter</div>
        ) : (
          <div className="galaxy-nodes">
            {visibleNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`galaxy-node galaxy-node-${node.category}`}
                data-status={node.status}
                aria-label={`${node.label}. ${node.statusLabel}`}
                disabled={!node.navigable}
                style={{ left: `${node.coordinates.x}%`, top: `${node.coordinates.y}%` }}
                onClick={() => {
                  if (node.navigable) onSelectNode(node);
                }}
              >
                <span className="galaxy-node-status-dot" aria-hidden="true" />
                <span className="galaxy-node-label">{node.label}</span>
                <span className="galaxy-node-status">{node.statusLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="galaxy-footer">
        <span>{visibleNodes.length} visible module{visibleNodes.length === 1 ? '' : 's'}</span>
        <span>States reflect ATLAS registry and authenticated availability.</span>
      </footer>
    </section>
  );
}
