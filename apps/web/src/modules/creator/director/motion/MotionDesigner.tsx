import { useEffect, useMemo, useState } from 'react';
import { createEmptyMotionComposition } from '../../../../../../../packages/creator/motion/defaults';
import { evaluateTrack } from '../../../../../../../packages/creator/motion/evaluator';
import { evaluateMotionExpression, parseMotionExpression } from '../../../../../../../packages/creator/motion/expression';
import { validateMotionComposition } from '../../../../../../../packages/creator/motion/validator';
import type { MotionCompositionSpec, MotionEasing, MotionLayer, MotionTrack } from '../../../../../../../packages/creator/motion/types';
import './MotionDesigner.css';

type MotionDesignerProps = {
  value: MotionCompositionSpec | null;
  durationSeconds: number;
  onChange: (composition: MotionCompositionSpec) => void;
};

const HISTORY_LIMIT = 50;

export function MotionDesigner({ value, durationSeconds, onChange }: MotionDesignerProps) {
  const spec = useMemo(() => value ?? createEmptyMotionComposition({ durationSeconds: Math.max(1, durationSeconds || 10) }), [durationSeconds, value]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [undoStack, setUndoStack] = useState<MotionCompositionSpec[]>([]);
  const [redoStack, setRedoStack] = useState<MotionCompositionSpec[]>([]);
  const [expressionDraft, setExpressionDraft] = useState('');
  const [expressionError, setExpressionError] = useState('');
  const issues = useMemo(() => validateMotionComposition(spec), [spec]);
  const selectedLayer = spec.layers.find(layer => layer.id === selected) || null;

  useEffect(() => {
    setExpressionDraft(selectedLayer?.expression?.source ?? '');
    setExpressionError('');
  }, [selectedLayer?.id, selectedLayer?.expression?.source]);

  function commit(next: MotionCompositionSpec, recordHistory = true) {
    if (recordHistory) {
      setUndoStack(history => [...history.slice(-(HISTORY_LIMIT - 1)), structuredClone(spec)]);
      setRedoStack([]);
    }
    onChange(next);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack(history => history.slice(0, -1));
    setRedoStack(history => [...history.slice(-(HISTORY_LIMIT - 1)), structuredClone(spec)]);
    onChange(previous);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack(history => history.slice(0, -1));
    setUndoStack(history => [...history.slice(-(HISTORY_LIMIT - 1)), structuredClone(spec)]);
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
      tracks: [], effects: [], expression: null
    };
    commit({ ...spec, layers: [...spec.layers, layer] });
    setSelected(id);
  }

  function updateLayer(patch: Partial<MotionLayer>) {
    if (!selectedLayer || selectedLayer.locked) return;
    commit({ ...spec, layers: spec.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, ...patch } : layer) });
  }

  function updateTransform(property: keyof MotionLayer['transform'], value: number) {
    if (!selectedLayer || selectedLayer.locked) return;
    updateLayer({ transform: { ...selectedLayer.transform, [property]: value } });
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

  function duplicateLayer() {
    if (!selectedLayer) return;
    const copy = structuredClone(selectedLayer);
    copy.id = crypto.randomUUID();
    copy.name = `${selectedLayer.name} copy`;
    copy.locked = false;
    copy.tracks = copy.tracks.map(track => ({
      ...track,
      id: crypto.randomUUID(),
      keyframes: track.keyframes.map(keyframe => ({ ...keyframe, id: crypto.randomUUID() }))
    }));
    const index = spec.layers.findIndex(layer => layer.id === selectedLayer.id);
    const layers = [...spec.layers];
    layers.splice(index + 1, 0, copy);
    commit({ ...spec, layers });
    setSelected(copy.id);
  }

  function moveLayer(direction: -1 | 1) {
    if (!selectedLayer) return;
    const index = spec.layers.findIndex(layer => layer.id === selectedLayer.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= spec.layers.length) return;
    const layers = [...spec.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    commit({ ...spec, layers });
  }

  function opacityTrack(layer: MotionLayer): MotionTrack | undefined {
    return layer.tracks.find(track => track.property === 'opacity');
  }

  function addOpacityKeyframe() {
    if (!selectedLayer || selectedLayer.locked) return;
    const track = opacityTrack(selectedLayer);
    const keyframe = {
      id: crypto.randomUUID(),
      time: Math.min(spec.durationSeconds, Math.max(0, playhead)),
      value: selectedLayer.transform.opacity ?? 1,
      easing: { type: 'linear' } as MotionEasing
    };
    const tracks = track
      ? selectedLayer.tracks.map(item => item.id === track.id ? { ...item, keyframes: [...item.keyframes, keyframe].sort((a, b) => a.time - b.time) } : item)
      : [...selectedLayer.tracks, { id: crypto.randomUUID(), property: 'opacity', keyframes: [keyframe] }];
    updateLayer({ tracks });
  }

  function deleteKeyframe(trackId: string, keyframeId: string) {
    if (!selectedLayer || selectedLayer.locked) return;
    updateLayer({
      tracks: selectedLayer.tracks.map(track => track.id === trackId ? { ...track, keyframes: track.keyframes.filter(keyframe => keyframe.id !== keyframeId) } : track)
    });
  }

  function changeKeyframeEasing(trackId: string, keyframeId: string, easing: MotionEasing) {
    if (!selectedLayer || selectedLayer.locked) return;
    updateLayer({
      tracks: selectedLayer.tracks.map(track => track.id === trackId ? {
        ...track,
        keyframes: track.keyframes.map(keyframe => keyframe.id === keyframeId ? { ...keyframe, easing } : keyframe)
      } : track)
    });
  }

  function applyExpression() {
    if (!selectedLayer || selectedLayer.locked) return;
    const source = expressionDraft.trim();
    if (!source) {
      setExpressionError('');
      updateLayer({ expression: null });
      return;
    }
    try {
      parseMotionExpression(source);
      setExpressionError('');
      updateLayer({ expression: { source } });
    } catch (error) {
      setExpressionError(error instanceof Error ? error.message : 'Invalid expression');
    }
  }

  function renderedOpacity(layer: MotionLayer) {
    let opacity = layer.transform.opacity ?? 1;
    const track = opacityTrack(layer);
    const tracked = track ? evaluateTrack(track, playhead) : undefined;
    if (typeof tracked === 'number') opacity = tracked;
    if (layer.expression?.source) {
      try {
        opacity = evaluateMotionExpression(parseMotionExpression(layer.expression.source), { time: playhead, properties: { opacity } });
      } catch {
        // Invalid expressions are blocked before save/apply; retain deterministic fallback.
      }
    }
    return Math.max(0, Math.min(1, opacity));
  }

  const opacity = selectedLayer ? opacityTrack(selectedLayer) : undefined;

  return <section className="motion-designer" aria-label="Motion Designer">
    <div className="motion-toolbar">
      <button type="button" onClick={() => addLayer('text')}>Add text</button>
      <button type="button" onClick={() => addLayer('shape')}>Add shape</button>
      <button type="button" onClick={undo} disabled={!undoStack.length}>Undo</button>
      <button type="button" onClick={redo} disabled={!redoStack.length}>Redo</button>
      <span role="status">{issues.length ? `${issues.length} validation issue(s)` : 'Composition valid'}</span>
    </div>

    <div className="motion-grid">
      <aside className="motion-panel" aria-label="Layers">
        <h3>Layers</h3>
        {spec.layers.length === 0 && <p>No layers yet.</p>}
        <div className="motion-layer-list">
          {spec.layers.map(layer => <button type="button" key={layer.id} aria-pressed={selected === layer.id} onClick={() => setSelected(layer.id)}>
            {layer.visible ? '◉' : '○'} {layer.name}{layer.locked ? ' · Locked' : ''}
          </button>)}
        </div>
        {selectedLayer && <div className="motion-row">
          <button type="button" onClick={duplicateLayer}>Duplicate</button>
          <button type="button" onClick={() => moveLayer(-1)}>Up</button>
          <button type="button" onClick={() => moveLayer(1)}>Down</button>
        </div>}
      </aside>

      <main className="motion-panel motion-preview-panel" aria-label="Canvas">
        <h3>Canvas</h3>
        <div className="motion-canvas" style={{ aspectRatio: `${spec.width}/${spec.height}`, background: spec.background }}>
          {spec.layers.filter(layer => layer.visible && layer.startSecond <= playhead && layer.endSecond >= playhead).map(layer => <div
            key={layer.id}
            data-layer={layer.kind}
            className={selected === layer.id ? 'motion-canvas-layer selected' : 'motion-canvas-layer'}
            style={{
              opacity: renderedOpacity(layer),
              transform: `translate(${layer.transform.positionX ?? 0}px,${layer.transform.positionY ?? 0}px) scale(${layer.transform.scaleX ?? 1},${layer.transform.scaleY ?? 1})`
            }}
          >{layer.kind === 'text' ? layer.name : '◆'}</div>)}
        </div>
      </main>

      <aside className="motion-panel motion-properties" aria-label="Properties">
        <h3>Properties</h3>
        {selectedLayer ? <>
          <label>Name<input value={selectedLayer.name} disabled={selectedLayer.locked} onChange={event => updateLayer({ name: event.target.value })} /></label>
          <div className="motion-property-grid">
            <label>X<input type="number" value={selectedLayer.transform.positionX ?? 0} disabled={selectedLayer.locked} onChange={event => updateTransform('positionX', Number(event.target.value))} /></label>
            <label>Y<input type="number" value={selectedLayer.transform.positionY ?? 0} disabled={selectedLayer.locked} onChange={event => updateTransform('positionY', Number(event.target.value))} /></label>
            <label>Scale X<input type="number" step="0.05" value={selectedLayer.transform.scaleX ?? 1} disabled={selectedLayer.locked} onChange={event => updateTransform('scaleX', Number(event.target.value))} /></label>
            <label>Scale Y<input type="number" step="0.05" value={selectedLayer.transform.scaleY ?? 1} disabled={selectedLayer.locked} onChange={event => updateTransform('scaleY', Number(event.target.value))} /></label>
            <label>Opacity<input type="number" min="0" max="1" step="0.05" value={selectedLayer.transform.opacity ?? 1} disabled={selectedLayer.locked} onChange={event => updateTransform('opacity', Number(event.target.value))} /></label>
          </div>
          <label><input type="checkbox" checked={selectedLayer.visible} disabled={selectedLayer.locked} onChange={event => updateLayer({ visible: event.target.checked })} /> Visible</label>
          <label><input type="checkbox" checked={selectedLayer.locked} onChange={event => setLayerLocked(event.target.checked)} /> Locked</label>
          <label>Expression (opacity)
            <input value={expressionDraft} disabled={selectedLayer.locked} placeholder="clamp(sin(time) + 1, 0, 1)" onChange={event => setExpressionDraft(event.target.value)} />
          </label>
          <button type="button" onClick={applyExpression} disabled={selectedLayer.locked}>Apply expression</button>
          {expressionError && <p className="motion-error" role="alert">{expressionError}</p>}
          <button type="button" onClick={removeLayer} disabled={selectedLayer.locked}>Delete layer</button>
        </> : <p>Select a layer.</p>}
      </aside>
    </div>

    <section className="motion-panel motion-timeline" aria-label="Timeline">
      <div className="motion-row"><h3>Timeline</h3><output>{playhead.toFixed(2)}s / {spec.durationSeconds.toFixed(2)}s</output></div>
      <input aria-label="Playhead" type="range" min={0} max={spec.durationSeconds} step={1 / spec.fps} value={Math.min(playhead, spec.durationSeconds)} onChange={event => setPlayhead(Number(event.target.value))} />
      {selectedLayer && <>
        <button type="button" onClick={addOpacityKeyframe} disabled={selectedLayer.locked}>Add opacity keyframe</button>
        <div className="motion-keyframes">
          {opacity?.keyframes.map(keyframe => <div key={keyframe.id} className="motion-keyframe-row">
            <span>{keyframe.time.toFixed(2)}s · {String(keyframe.value)}</span>
            <select aria-label={`Easing at ${keyframe.time.toFixed(2)} seconds`} value={keyframe.easing.type} disabled={selectedLayer.locked} onChange={event => changeKeyframeEasing(opacity.id, keyframe.id, { type: event.target.value as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' })}>
              <option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option>
            </select>
            <button type="button" onClick={() => deleteKeyframe(opacity.id, keyframe.id)} disabled={selectedLayer.locked}>Delete</button>
          </div>)}
          {!opacity?.keyframes.length && <p>No opacity keyframes.</p>}
        </div>
      </>}
    </section>
  </section>;
}
