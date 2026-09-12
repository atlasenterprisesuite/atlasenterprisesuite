import type {
  CameraSpec,
  ContinuityRule,
  MotionRule,
  NegativeConstraint,
  ProductionSpec,
  VisualStyleSpec
} from '../../../../../../packages/creator/types';
import type { DirectorAction } from './directorState';

const splitLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);
const joinLines = (value: readonly string[]) => value.join('\n');
type Props = { spec: ProductionSpec; dispatch: (action: DirectorAction) => void };

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="director-field"><span>{label}</span><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="director-field director-field-wide"><span>{label}</span><textarea aria-label={label} rows={4} value={joinLines(value)} onChange={event => onChange(splitLines(event.target.value))} /></label>;
}

const CONTINUITY_TYPES: ContinuityRule['ruleType'][] = ['identity','orientation','wardrobe-or-surface','material','lighting','position','camera-axis','motion-direction','damage-or-scar','object-presence','transformation-continuity','custom'];

export function ContinuityEditor({ spec, dispatch }: Props) {
  const addRule = () => dispatch({ type: 'continuity.add', rule: { id: crypto.randomUUID(), ruleType: 'identity', subjectId: null, description: '', startShotId: null, endShotId: null, severity: 'warning' } });
  const addNegative = () => dispatch({ type: 'negative.add', constraint: { id: crypto.randomUUID(), scope: 'production', value: '', severity: 'warning' } });
  return <div className="director-editor-stack">
    <div className="director-editor-toolbar"><p>Rules remain explicit; empty descriptions stay incomplete until the user defines them.</p><div className="director-inline-actions"><button className="director-action" type="button" onClick={addRule}>Add continuity rule</button><button className="director-action secondary" type="button" onClick={addNegative}>Add negative constraint</button></div></div>
    {spec.continuityRules.map(rule => {
      const update = (patch: Partial<ContinuityRule>) => dispatch({ type: 'continuity.update', ruleId: rule.id, patch });
      return <article className="director-editor-card" key={rule.id}><div className="director-card-heading"><strong>{rule.description || 'Incomplete continuity rule'}</strong><button className="director-text-action danger" type="button" onClick={() => dispatch({ type: 'continuity.remove', ruleId: rule.id })}>Remove rule</button></div><div className="director-form-grid">
        <label className="director-field"><span>Rule type</span><select aria-label="Continuity rule type" value={rule.ruleType} onChange={event => update({ ruleType: event.target.value as ContinuityRule['ruleType'] })}>{CONTINUITY_TYPES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="director-field"><span>Subject</span><select aria-label="Continuity subject" value={rule.subjectId || ''} onChange={event => update({ subjectId: event.target.value || null })}><option value="">Production-wide</option>{spec.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label || subject.id}</option>)}</select></label>
        <label className="director-field director-field-wide"><span>Description</span><textarea aria-label="Continuity description" rows={3} value={rule.description} onChange={event => update({ description: event.target.value })} /></label>
        <label className="director-field"><span>Start shot</span><select aria-label="Continuity start shot" value={rule.startShotId || ''} onChange={event => update({ startShotId: event.target.value || null })}><option value="">Not bounded</option>{spec.scenes.flatMap(scene => scene.shots).map(shot => <option key={shot.id} value={shot.id}>{shot.title || `Shot ${shot.order}`}</option>)}</select></label>
        <label className="director-field"><span>End shot</span><select aria-label="Continuity end shot" value={rule.endShotId || ''} onChange={event => update({ endShotId: event.target.value || null })}><option value="">Not bounded</option>{spec.scenes.flatMap(scene => scene.shots).map(shot => <option key={shot.id} value={shot.id}>{shot.title || `Shot ${shot.order}`}</option>)}</select></label>
        <label className="director-field"><span>Severity</span><select aria-label="Continuity severity" value={rule.severity} onChange={event => update({ severity: event.target.value as ContinuityRule['severity'] })}><option value="warning">Warning</option><option value="blocking">Blocking</option></select></label>
      </div></article>;
    })}
    {spec.negativeConstraints.map(constraint => {
      const update = (patch: Partial<NegativeConstraint>) => dispatch({ type: 'negative.update', constraintId: constraint.id, patch });
      return <article className="director-editor-card" key={constraint.id}><div className="director-card-heading"><strong>{constraint.value || 'Incomplete negative constraint'}</strong><button className="director-text-action danger" type="button" onClick={() => dispatch({ type: 'negative.remove', constraintId: constraint.id })}>Remove constraint</button></div><div className="director-form-grid">
        <label className="director-field"><span>Scope</span><select aria-label="Negative constraint scope" value={constraint.scope} onChange={event => update({ scope: event.target.value as NegativeConstraint['scope'] })}><option value="production">Production</option><option value="scene">Scene</option><option value="shot">Shot</option><option value="subject">Subject</option></select></label>
        <label className="director-field"><span>Severity</span><select aria-label="Negative constraint severity" value={constraint.severity} onChange={event => update({ severity: event.target.value as NegativeConstraint['severity'] })}><option value="preference">Preference</option><option value="warning">Warning</option><option value="blocking">Blocking</option></select></label>
        <label className="director-field director-field-wide"><span>Constraint</span><textarea aria-label="Negative constraint" rows={3} value={constraint.value} onChange={event => update({ value: event.target.value })} /></label>
      </div></article>;
    })}
    {spec.continuityRules.length === 0 && spec.negativeConstraints.length === 0 && <div className="director-inline-empty">No continuity rules or negative constraints defined.</div>}
  </div>;
}

const STYLE_FIELDS: Array<[keyof VisualStyleSpec, string]> = [
  ['photorealismLevel','Photorealism level'],['cinematicStyle','Cinematic style'],['textureStyle','Texture style'],['colorPalette','Color palette'],['contrastStyle','Contrast style'],['filmLook','Film look'],['grain','Grain'],['halation','Halation'],['surfaceDetail','Surface detail'],['lightingStyle','Lighting style']
];
export function VisualStyleEditor({ spec, dispatch }: Props) {
  const update = (key: keyof VisualStyleSpec, value: string) => dispatch({ type: 'root.patch', patch: { visualStyle: { ...spec.visualStyle, [key]: value } } });
  return <div className="director-form-grid">{STYLE_FIELDS.map(([key,label]) => <Field key={key} label={label} value={spec.visualStyle[key]} onChange={value => update(key, value)} />)}</div>;
}

const CAMERA_FIELDS: Array<[Exclude<keyof CameraSpec,'focalLengthMm'>, string]> = [
  ['framing','Default framing'],['angle','Default camera angle'],['position','Default camera position'],['lens','Default lens'],['depthOfField','Default depth of field'],['movement','Default camera movement'],['movementSpeed','Default movement speed'],['focusTarget','Default focus target'],['orientationRule','Default orientation rule']
];
export function CameraMotionEditor({ spec, dispatch }: Props) {
  const updateCamera = (patch: Partial<CameraSpec>) => dispatch({ type: 'root.patch', patch: { cameraDefaults: { ...spec.cameraDefaults, ...patch } } });
  const updateRules = (motionRules: MotionRule[]) => dispatch({ type: 'root.patch', patch: { motionRules } });
  const addRule = () => updateRules([...spec.motionRules, { id: crypto.randomUUID(), subjectId: null, movementDescription: '', direction: '', speedProfile: '', physicality: '', mustRemainContinuous: false }]);
  return <div className="director-editor-stack"><div className="director-form-grid">{CAMERA_FIELDS.map(([key,label]) => <Field key={key} label={label} value={spec.cameraDefaults[key]} onChange={value => updateCamera({ [key]: value })} />)}<label className="director-field"><span>Default focal length (mm)</span><input aria-label="Default focal length" type="number" step="0.1" value={spec.cameraDefaults.focalLengthMm ?? ''} onChange={event => updateCamera({ focalLengthMm: event.target.value === '' ? null : Number(event.target.value) })} /></label></div><div className="director-editor-toolbar"><p>Motion rules make direction and physicality explicit across shots.</p><button className="director-action" type="button" onClick={addRule}>Add motion rule</button></div>{spec.motionRules.map(rule => {
    const update = (patch: Partial<MotionRule>) => updateRules(spec.motionRules.map(item => item.id === rule.id ? { ...item, ...patch } : item));
    return <article className="director-editor-card" key={rule.id}><div className="director-card-heading"><strong>{rule.movementDescription || 'Incomplete motion rule'}</strong><button className="director-text-action danger" type="button" onClick={() => updateRules(spec.motionRules.filter(item => item.id !== rule.id))}>Remove motion rule</button></div><div className="director-form-grid"><label className="director-field"><span>Subject</span><select aria-label="Motion subject" value={rule.subjectId || ''} onChange={event => update({ subjectId: event.target.value || null })}><option value="">Production-wide</option>{spec.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label || subject.id}</option>)}</select></label><Field label="Movement description" value={rule.movementDescription} onChange={movementDescription => update({ movementDescription })} /><Field label="Rule direction" value={rule.direction} onChange={direction => update({ direction })} /><Field label="Rule speed profile" value={rule.speedProfile} onChange={speedProfile => update({ speedProfile })} /><Field label="Rule physicality" value={rule.physicality} onChange={physicality => update({ physicality })} /><label className="director-check"><input aria-label="Continuous motion" type="checkbox" checked={rule.mustRemainContinuous} onChange={event => update({ mustRemainContinuous: event.target.checked })} /><span>Must remain continuous</span></label></div></article>;
  })}</div>;
}

export function AudioEditor({ spec, dispatch }: Props) {
  const audio = spec.audioPlan;
  const update = (patch: Partial<ProductionSpec['audioPlan']>) => dispatch({ type: 'root.patch', patch: { audioPlan: { ...audio, ...patch } } });
  return <div className="director-form-grid"><label className="director-field director-field-wide"><span>Music description</span><textarea aria-label="Music description" rows={3} value={audio.musicDescription} onChange={event => update({ musicDescription: event.target.value })} /></label><label className="director-field director-field-wide"><span>Ambient sound</span><textarea aria-label="Ambient sound" rows={3} value={audio.ambientSound} onChange={event => update({ ambientSound: event.target.value })} /></label><ListField label="Sound effects" value={audio.soundEffects} onChange={soundEffects => update({ soundEffects })} /><ListField label="Dialogue" value={audio.dialogue} onChange={dialogue => update({ dialogue })} /><ListField label="Voice reference asset IDs" value={audio.voiceReferenceAssetIds} onChange={voiceReferenceAssetIds => update({ voiceReferenceAssetIds })} /><ListField label="Audio sync rules" value={audio.syncRules} onChange={syncRules => update({ syncRules })} /></div>;
}
