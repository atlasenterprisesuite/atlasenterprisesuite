import { useEffect, useMemo, useState } from 'react';
import type { PortalDestination } from './portalModel';

export function AtlasPortalDeck({
  destinations,
  onEnter,
  onSelectionChange
}: {
  destinations: readonly PortalDestination[];
  onEnter: (destination: PortalDestination) => void;
  onSelectionChange?: (destination: PortalDestination | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const areas = useMemo(
    () => ['All', ...Array.from(new Set(destinations.map((destination) => destination.area))).sort()],
    [destinations]
  );

  const visibleDestinations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return destinations.filter((destination) => {
      const matchesArea = area === 'All' || destination.area === area;
      const matchesQuery = !normalizedQuery
        || destination.label.toLocaleLowerCase().includes(normalizedQuery)
        || destination.title.toLocaleLowerCase().includes(normalizedQuery)
        || destination.description.toLocaleLowerCase().includes(normalizedQuery);
      return matchesArea && matchesQuery;
    });
  }, [area, destinations, query]);

  const selected = visibleDestinations.find((destination) => destination.id === selectedId)
    ?? visibleDestinations[0]
    ?? null;

  useEffect(() => {
    onSelectionChange?.(selected);
  }, [onSelectionChange, selected]);

  return (
    <section className="portal-deck" aria-labelledby="atlas-portals-title">
      <header className="portal-toolbar">
        <div>
          <p className="portal-eyebrow">Spatial module gateway</p>
          <h2 id="atlas-portals-title">ATLAS Portals</h2>
          <p className="portal-subtitle">
            Select a registered destination. Access and readiness remain governed by the canonical ATLAS module registry.
          </p>
        </div>

        <label className="portal-search">
          <span>Search portals</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Health, Finance, Work..."
          />
        </label>
      </header>

      <div className="portal-area-filters" aria-label="Portal area filters">
        {areas.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={area === item}
            onClick={() => setArea(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="portal-layout">
        <div className="portal-stage" aria-live="polite">
          {selected ? (
            <>
              <div className="portal-visual" data-status={selected.status} aria-hidden="true">
                <div className="portal-ring portal-ring-outer" />
                <div className="portal-ring portal-ring-middle" />
                <div className="portal-window">
                  <span className="portal-window-area">{selected.area}</span>
                  <strong>{selected.label}</strong>
                  <small>{selected.statusLabel}</small>
                </div>
              </div>

              <div className="portal-selection">
                <p className="portal-eyebrow">Focused destination</p>
                <h3>{selected.title}</h3>
                <p>{selected.description}</p>
                <div className="portal-selection-meta">
                  <span>{selected.area}</span>
                  <span>{selected.statusLabel}</span>
                </div>
                <button
                  type="button"
                  className="portal-enter"
                  disabled={!selected.navigable}
                  onClick={() => onEnter(selected)}
                >
                  {selected.navigable ? `Enter ${selected.label}` : selected.statusLabel}
                </button>
              </div>
            </>
          ) : (
            <div className="portal-empty">No portals match the current filters.</div>
          )}
        </div>

        <div className="portal-destination-list" aria-label="ATLAS portal destinations">
          {visibleDestinations.length === 0 ? (
            <div className="portal-empty">No portals match the current filters.</div>
          ) : (
            visibleDestinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                className="portal-destination"
                data-status={destination.status}
                aria-pressed={selected?.id === destination.id}
                disabled={!destination.navigable}
                onClick={() => setSelectedId(destination.id)}
              >
                <span className="portal-destination-orb" aria-hidden="true" />
                <span className="portal-destination-copy">
                  <strong>{destination.label}</strong>
                  <small>{destination.area}</small>
                </span>
                <span className="portal-destination-status">{destination.statusLabel}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <footer className="portal-footer">
        <span>{visibleDestinations.length} visible portal{visibleDestinations.length === 1 ? '' : 's'}</span>
        <span>No portal bypasses ATLAS identity, tenant, RBAC or provider gates.</span>
      </footer>
    </section>
  );
}
