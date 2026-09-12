import { createEmptyScene, createEmptyShot } from '../../../../../../packages/creator/defaults';
import type { ProductionSpec, SceneSpec, ShotSpec } from '../../../../../../packages/creator/types';
import type { DirectorAction } from './directorState';

const splitLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);
const joinLines = (value: readonly string[]) => value.join('\n');

type Props = { spec: ProductionSpec; dispatch: (action: DirectorAction) => void };

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="director-field"><span>{label}</span><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="director-field director-field-wide"><span>{label}</span><textarea aria-label={label} rows={3} value={joinLines(value)} onChange={event => onChange(splitLines(event.target.value))} /></label>;
}

function ShotCard({ spec, scene, shot, dispatch }: Props & { scene: SceneSpec; shot: ShotSpec }) {
  const update = (patch: Partial<ShotSpec>) => dispatch({ type: 'shot.update', sceneId: scene.id, shotId: shot.id, patch });
  const duplicate = () => dispatch({
    type: 'shot.duplicate', sceneId: scene.id, shotId: shot.id,
    shot: {
      ...shot,
      id: crypto.randomUUID(),
      camera: { ...shot.camera }, motion: { ...shot.motion },
      subjectIds: [...shot.subjectIds], materials: [...shot.materials], audioCueIds: [...shot.audioCueIds],
      continuityNotes: [...shot.continuityNotes], negativeConstraints: [...shot.negativeConstraints]
    }
  });
  return <article className="director-shot-card" data-testid="director-shot-card">
    <div className="director-card-heading"><strong>Shot {shot.order}</strong><div className="director-inline-actions"><button type="button" className="director-text-action" aria-label="Move shot up" disabled={shot.order <= 1} onClick={() => dispatch({ type: 'shot.move', sceneId: scene.id, shotId: shot.id, direction: 'up' })}>↑</button><button type="button" className="director-text-action" aria-label="Move shot down" disabled={shot.order >= scene.shots.length} onClick={() => dispatch({ type: 'shot.move', sceneId: scene.id, shotId: shot.id, direction: 'down' })}>↓</button><button type="button" className="director-text-action" onClick={duplicate}>Duplicate shot</button><button type="button" className="director-text-action danger" onClick={() => dispatch({ type: 'shot.remove', sceneId: scene.id, shotId: shot.id })}>Remove shot</button></div></div>
    <div className="director-form-grid">
      <Field label="Shot title" value={shot.title} onChange={title => update({ title })} />
      <label className="director-field"><span>Subjects</span><select multiple aria-label="Shot subjects" value={shot.subjectIds} onChange={event => update({ subjectIds: Array.from(event.currentTarget.selectedOptions as HTMLOptionsCollection, option => option.value) })}>{spec.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label || subject.id}</option>)}</select></label>
      <label className="director-field"><span>Shot start</span><input type="number" step="0.1" aria-label="Shot start" value={shot.startSecond} onChange={event => update({ startSecond: Number(event.target.value) })} /></label>
      <label className="director-field"><span>Shot end</span><input type="number" step="0.1" aria-label="Shot end" value={shot.endSecond} onChange={event => update({ endSecond: Number(event.target.value) })} /></label>
      <label className="director-field director-field-wide"><span>Action</span><textarea aria-label="Shot action" rows={4} value={shot.action} onChange={event => update({ action: event.target.value })} /></label>
      <Field label="Framing" value={shot.camera.framing} onChange={framing => update({ camera: { ...shot.camera, framing } })} />
      <Field label="Camera angle" value={shot.camera.angle} onChange={angle => update({ camera: { ...shot.camera, angle } })} />
      <Field label="Camera position" value={shot.camera.position} onChange={position => update({ camera: { ...shot.camera, position } })} />
      <Field label="Lens" value={shot.camera.lens} onChange={lens => update({ camera: { ...shot.camera, lens } })} />
      <label className="director-field"><span>Focal length (mm)</span><input aria-label="Focal length" type="number" step="0.1" value={shot.camera.focalLengthMm ?? ''} onChange={event => update({ camera: { ...shot.camera, focalLengthMm: event.target.value === '' ? null : Number(event.target.value) } })} /></label>
      <Field label="Depth of field" value={shot.camera.depthOfField} onChange={depthOfField => update({ camera: { ...shot.camera, depthOfField } })} />
      <Field label="Camera movement" value={shot.camera.movement} onChange={movement => update({ camera: { ...shot.camera, movement } })} />
      <Field label="Camera movement speed" value={shot.camera.movementSpeed} onChange={movementSpeed => update({ camera: { ...shot.camera, movementSpeed } })} />
      <Field label="Focus target" value={shot.camera.focusTarget} onChange={focusTarget => update({ camera: { ...shot.camera, focusTarget } })} />
      <Field label="Orientation rule" value={shot.camera.orientationRule} onChange={orientationRule => update({ camera: { ...shot.camera, orientationRule } })} />
      <Field label="Motion direction" value={shot.motion.direction} onChange={direction => update({ motion: { ...shot.motion, direction } })} />
      <Field label="Motion speed profile" value={shot.motion.speedProfile} onChange={speedProfile => update({ motion: { ...shot.motion, speedProfile } })} />
      <Field label="Motion physicality" value={shot.motion.physicality} onChange={physicality => update({ motion: { ...shot.motion, physicality } })} />
      <Field label="Shot lighting" value={shot.lighting} onChange={lighting => update({ lighting })} />
      <Field label="Transition in" value={shot.transitionIn} onChange={transitionIn => update({ transitionIn })} />
      <Field label="Transition out" value={shot.transitionOut} onChange={transitionOut => update({ transitionOut })} />
      <ListField label="Shot materials" value={shot.materials} onChange={materials => update({ materials })} />
      <ListField label="Audio cue IDs" value={shot.audioCueIds} onChange={audioCueIds => update({ audioCueIds })} />
      <ListField label="Continuity notes" value={shot.continuityNotes} onChange={continuityNotes => update({ continuityNotes })} />
      <ListField label="Shot negative constraints" value={shot.negativeConstraints} onChange={negativeConstraints => update({ negativeConstraints })} />
    </div>
  </article>;
}

function SceneCard({ spec, scene, dispatch }: Props & { scene: SceneSpec }) {
  const updateScene = (patch: Partial<SceneSpec>) => dispatch({ type: 'scene.update', sceneId: scene.id, patch });
  const addShot = () => dispatch({ type: 'shot.add', sceneId: scene.id, shot: createEmptyShot({ order: scene.shots.length + 1 }) });
  return <article className="director-editor-card">
    <div className="director-card-heading"><strong>{scene.title || 'Untitled scene'}</strong><div className="director-inline-actions"><button className="director-action secondary" type="button" onClick={addShot}>Add shot</button><button className="director-text-action danger" type="button" onClick={() => dispatch({ type: 'scene.remove', sceneId: scene.id })}>Remove scene</button></div></div>
    <div className="director-form-grid">
      <Field label="Scene title" value={scene.title} onChange={title => updateScene({ title })} />
      <label className="director-field"><span>Scene start</span><input aria-label="Scene start" type="number" step="0.1" value={scene.startSecond} onChange={event => updateScene({ startSecond: Number(event.target.value) })} /></label>
      <label className="director-field"><span>Scene end</span><input aria-label="Scene end" type="number" step="0.1" value={scene.endSecond} onChange={event => updateScene({ endSecond: Number(event.target.value) })} /></label>
      <label className="director-field director-field-wide"><span>Scene description</span><textarea aria-label="Scene description" rows={3} value={scene.description} onChange={event => updateScene({ description: event.target.value })} /></label>
    </div>
    <div className="director-shot-list">{scene.shots.length === 0 ? <div className="director-inline-empty">No shots in this scene.</div> : scene.shots.map(shot => <ShotCard key={shot.id} spec={spec} scene={scene} shot={shot} dispatch={dispatch} />)}</div>
  </article>;
}

export function SceneShotEditor({ spec, dispatch }: Props) {
  return <div className="director-editor-stack">
    <div className="director-editor-toolbar"><p>Scenes own timing; shots stay ordered with explicit accessible controls.</p><button className="director-action" type="button" onClick={() => dispatch({ type: 'scene.add', scene: createEmptyScene() })}>Add scene</button></div>
    {spec.scenes.length === 0 ? <div className="director-inline-empty">No scenes defined.</div> : spec.scenes.map(scene => <SceneCard key={scene.id} spec={spec} scene={scene} dispatch={dispatch} />)}
  </div>;
}
