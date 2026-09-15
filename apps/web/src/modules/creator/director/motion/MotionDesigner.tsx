import { useMemo, useState } from 'react';
import { createEmptyMotionComposition } from '../../../../../../../packages/creator/motion/defaults';
import { validateMotionComposition } from '../../../../../../../packages/creator/motion/validator';
import type { MotionCompositionSpec, MotionLayer } from '../../../../../../../packages/creator/motion/types';

type MotionDesignerProps = {
  value: MotionCompositionSpec | null;
  durationSeconds: number;
  onChange: (composition: MotionCompositionSpec) => void;
};

export function MotionDesigner({ value, durationSeconds, onChange }: MotionDesignerProps) {
  const spec = useMemo(() => value ?? createEmptyMotionComposition({ durationSeconds: Math.max(1, durationSeconds || 10) }), [durationSeconds, value]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const issues = useMemo(() => validateMotionComposition(spec), [spec]);
  const selectedLayer = spec.layers.find(layer => layer.id === selected) || null;

  function commit(next: MotionCompositionSpec) {
    onChange(next);
  }

  function addLayer(kind: MotionLayer['kind']) {
    const id = crypto.randomUUID();
    const layer: MotionLayer = {
      id,
      name: kind === 'text' ? 'Text' : 'Shape',
      kind,
      sceneId: null,
      parentLayerId: null,
      startSecond: 0,
      endSecond: spec.durationSeconds,
      visible: true,
      locked: false,
      transform: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      tracks: [],
      effects: [],
      expression: null
    };
    commit({ ...spec, layers: [...spec.layers, layer] });
    setSelected(id);
  }

  function updateLayer(patch: Partial<MotionLayer>) {
    if (!selectedLayer || selectedLayer.locked) return;
    commit({ ...spec, layers: spec.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, ...patch } : layer) });
  }

  function setLayerLocked(locked: boolean) {
    if (!selectedLayer) return;
    commit({ ...spec, layers: spec.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, locked } : layer) });
  }

  function removeLayer() {
    if (!selectedLayer || selectedLayer.locked) return;
    commit({ ...spec, layers: spec.layers.filter(layer => layer.id !== selectedLayer.id) });
    setSelected(null);
  }

  return <section className="motion-designer" aria-label="Motion Designer">
    <div className="motion-toolbar">
      <button type="button" onClick={() => addLayer('text')}>Add text</button>
      <button type="button" onClick={() => addLayer('shape')}>Add shape</button>
      <span role="status">{issues.length ? `${issues.length} validation issue(s)` : 'Composition valid'}</span>
    </div>
    <div className="motion-grid">
      <aside aria-label="Layers">
        <h3>Layers</h3>
        {spec.layers.length === 0 && <p>No layers yet.</p>}
        {spec.layers.map(layer => <button type="button" key={layer.id} aria-pressed={selected === layer.id} onClick={() => setSelected(layer.id)}>
          {layer.visible ? '◉' : '○'} {layer.name}{layer.locked ? ' · Locked' : ''}
        </button>)}
      </aside>
      <main aria-label="Canvas">
        <h3>Canvas</h3>
        <div className="motion-canvas" style={{ aspectRatio: `${spec.width}/${spec.height}`, background: spec.background }}>
          {spec.layers.filter(layer => layer.visible && layer.startSecond <= playhead && layer.endSecond >= playhead).map(layer => <div
            key={layer.id}
            data-layer={layer.kind}
            style={{
              opacity: layer.transform.opacity ?? 1,
              transform: `translate(${layer.transform.positionX ?? 0}px,${layer.transform.positionY ?? 0}px) scale(${layer.transform.scaleX ?? 1},${layer.transform.scaleY ?? 1})`
            }}
          >{layer.kind === 'text' ? layer.name : '◆'}</div>)}
        </div>
      </main>
      <aside aria-label="Properties">
        <h3>Properties</h3>
        {selectedLayer ? <>
          <label>Name<input value={selectedLayer.name} disabled={selectedLayer.locked} onChange={event => updateLayer({ name: event.target.value })} /></label>
          <label><input type="checkbox" checked={selectedLayer.visible} disabled={selectedLayer.locked} onChange={event => updateLayer({ visible: event.target.checked })} /> Visible</label>
          <label><input type="checkbox" checked={selectedLayer.locked} onChange={event => setLayerLocked(event.target.checked)} /> Locked</label>
          <button type="button" onClick={removeLayer} disabled={selectedLayer.locked}>Delete</button>
        </> : <p>Select a layer.</p>}
      </aside>
    </div>
    <section aria-label="Timeline">
      <h3>Timeline</h3>
      <input aria-label="Playhead" type="range" min={0} max={spec.durationSeconds} step={1 / spec.fps} value={Math.min(playhead, spec.durationSeconds)} onChange={event => setPlayhead(Number(event.target.value))} />
      <output>{playhead.toFixed(2)}s</output>
    </section>
  </section>;
}
