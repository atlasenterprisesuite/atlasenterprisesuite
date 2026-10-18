import { useMemo, useState } from 'react';
import { findIndoorRoute, type IndoorBuilding, type IndoorNode } from './immersiveSpatial';

type IndoorNavigationPanelProps = {
  building: IndoorBuilding | null;
  enterLabel?: string;
  floorLabel?: string;
};

export function IndoorNavigationPanel({
  building,
  enterLabel = 'Entrar al edificio',
  floorLabel = 'Piso'
}: IndoorNavigationPanelProps) {
  const [entered, setEntered] = useState(false);
  const [levelId, setLevelId] = useState(building?.levels[0]?.id || '');
  const [destinationId, setDestinationId] = useState('');
  const [route, setRoute] = useState<IndoorNode[]>([]);

  const entrances = useMemo(
    () => building?.nodes.filter((node) => building.entranceNodeIds.includes(node.id)) || [],
    [building]
  );

  const visibleNodes = useMemo(
    () => building?.nodes.filter((node) => node.position.level === levelId) || [],
    [building, levelId]
  );

  if (!building) {
    return (
      <section className="gps4d-indoor-panel gps4d-indoor-blocked" aria-label="ATLAS indoor navigation status">
        <div>
          <strong>Indoor</strong>
          <span className="capability-state blocked">BLOCKED</span>
        </div>
        <p>No hay un modelo indoor autorizado para este destino. ATLAS no inventa pisos, pasillos ni habitaciones.</p>
      </section>
    );
  }

  const entrance = entrances[0] || null;

  function routeTo(nodeId: string) {
    setDestinationId(nodeId);
    if (!entrance) {
      setRoute([]);
      return;
    }
    setRoute(findIndoorRoute(building!, entrance.id, nodeId));
  }

  if (!entered) {
    return (
      <section className="gps4d-indoor-panel" aria-label="ATLAS indoor navigation available">
        <div className="gps4d-indoor-heading">
          <div>
            <strong>{building.label}</strong>
            <span>Fuente indoor: {building.source}</span>
          </div>
          <button type="button" disabled={!entrance} onClick={() => setEntered(true)}>
            {enterLabel}
          </button>
        </div>
        {!entrance && <p className="muted">El modelo no tiene una entrada verificable.</p>}
      </section>
    );
  }

  return (
    <section className="gps4d-indoor-panel gps4d-indoor-active" aria-label="ATLAS indoor navigation">
      <div className="gps4d-indoor-heading">
        <div>
          <strong>{building.label}</strong>
          <span>Fuente indoor: {building.source}</span>
        </div>
        <button type="button" onClick={() => { setEntered(false); setRoute([]); }}>
          Salir del edificio
        </button>
      </div>

      <label className="gps4d-indoor-floor">
        <span>{floorLabel}</span>
        <select value={levelId} onChange={(event) => { setLevelId(event.target.value); setRoute([]); }}>
          {building.levels.map((level) => (
            <option key={level.id} value={level.id}>{level.label}</option>
          ))}
        </select>
      </label>

      <div className="gps4d-indoor-destinations">
        {visibleNodes
          .filter((node) => node.kind === 'room' || node.kind === 'poi' || node.kind === 'elevator' || node.kind === 'stairs')
          .map((node) => (
            <button
              key={node.id}
              type="button"
              aria-pressed={destinationId === node.id}
              onClick={() => routeTo(node.id)}
            >
              {node.label}
            </button>
          ))}
      </div>

      <div className="gps4d-indoor-route" role="status">
        {route.length > 0 ? (
          <>
            <strong>Ruta indoor verificada</strong>
            <ol>
              {route.map((node) => (
                <li key={node.id}>
                  {node.label} · {node.position.level}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <span>Selecciona un destino interior.</span>
        )}
      </div>
    </section>
  );
}
