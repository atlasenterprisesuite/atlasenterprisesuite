import { createEmptySubject } from '../../../../../../packages/creator/defaults';
import type { ProductionSpec, SubjectSpec } from '../../../../../../packages/creator/types';
import type { DirectorAction } from './directorState';

const splitLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);
const joinLines = (value: readonly string[]) => value.join('\n');

type EditorProps = { spec: ProductionSpec; dispatch: (action: DirectorAction) => void };

function TextList({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="director-field director-field-wide"><span>{label}</span><textarea aria-label={label} rows={4} value={joinLines(value)} onChange={event => onChange(splitLines(event.target.value))} /></label>;
}

export function CreativeBriefEditor({ spec, dispatch }: EditorProps) {
  return <div className="director-form-grid">
    <label className="director-field"><span>Title</span><input aria-label="Production title" value={spec.title} onChange={event => dispatch({ type: 'root.patch', patch: { title: event.target.value } })} /></label>
    <label className="director-field"><span>Duration (seconds)</span><input aria-label="Production duration" type="number" min="0" step="0.1" value={spec.durationSeconds} onChange={event => dispatch({ type: 'root.patch', patch: { durationSeconds: Number(event.target.value) } })} /></label>
    <label className="director-field director-field-wide"><span>Creative brief</span><textarea aria-label="Creative brief" rows={8} value={spec.brief} onChange={event => dispatch({ type: 'root.patch', patch: { brief: event.target.value } })} /></label>
    <label className="director-field"><span>Aspect ratio</span><select aria-label="Aspect ratio" value={spec.aspectRatio} onChange={event => dispatch({ type: 'root.patch', patch: { aspectRatio: event.target.value as ProductionSpec['aspectRatio'] } })}><option value="adaptive">Adaptive</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="3:4">3:4</option><option value="9:16">9:16</option><option value="21:9">21:9</option></select></label>
    <label className="director-field"><span>Resolution</span><select aria-label="Resolution preference" value={spec.resolutionPreference} onChange={event => dispatch({ type: 'root.patch', patch: { resolutionPreference: event.target.value as ProductionSpec['resolutionPreference'] } })}><option value="adaptive">Adaptive</option><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="2k">2K</option><option value="4k">4K</option></select></label>
    <label className="director-check director-field-wide"><input aria-label="Synchronized audio" type="checkbox" checked={spec.audioEnabled} onChange={event => dispatch({ type: 'root.patch', patch: { audioEnabled: event.target.checked } })} /><span>Request synchronized audio when supported</span></label>
  </div>;
}

function SubjectCard({ subject, dispatch }: { subject: SubjectSpec; dispatch: (action: DirectorAction) => void }) {
  const update = (patch: Partial<SubjectSpec>) => dispatch({ type: 'subject.update', subjectId: subject.id, patch });
  return <article className="director-editor-card">
    <div className="director-card-heading"><strong>{subject.label || 'Unnamed subject'}</strong><button className="director-text-action" type="button" onClick={() => dispatch({ type: 'subject.remove', subjectId: subject.id })}>Remove subject</button></div>
    <div className="director-form-grid">
      <label className="director-field"><span>Label</span><input aria-label="Subject label" value={subject.label} onChange={event => update({ label: event.target.value })} /></label>
      <label className="director-check"><input aria-label="Identity lock" type="checkbox" checked={subject.identityLock} onChange={event => update({ identityLock: event.target.checked })} /><span>Identity lock</span></label>
      <label className="director-field director-field-wide"><span>Description</span><textarea aria-label="Subject description" rows={4} value={subject.description} onChange={event => update({ description: event.target.value })} /></label>
      <TextList label="Appearance traits" value={subject.appearanceTraits} onChange={appearanceTraits => update({ appearanceTraits })} />
      <TextList label="Material traits" value={subject.materialTraits} onChange={materialTraits => update({ materialTraits })} />
      <TextList label="Allowed transformations" value={subject.allowedTransformations} onChange={allowedTransformations => update({ allowedTransformations })} />
      <TextList label="Forbidden changes" value={subject.forbiddenChanges} onChange={forbiddenChanges => update({ forbiddenChanges })} />
      <TextList label="Reference asset IDs" value={subject.referenceAssetIds} onChange={referenceAssetIds => update({ referenceAssetIds })} />
    </div>
  </article>;
}

export function SubjectEditor({ spec, dispatch }: EditorProps) {
  return <div className="director-editor-stack">
    <div className="director-editor-toolbar"><p>Identity-locked subjects remain consistent across the shot plan unless an allowed transformation is explicit.</p><button className="director-action" type="button" onClick={() => dispatch({ type: 'subject.add', subject: createEmptySubject() })}>Add subject</button></div>
    {spec.subjects.length === 0 ? <div className="director-inline-empty">No subjects defined.</div> : spec.subjects.map(subject => <SubjectCard key={subject.id} subject={subject} dispatch={dispatch} />)}
  </div>;
}

export function EnvironmentEditor({ spec, dispatch }: EditorProps) {
  const environment = spec.environment;
  const update = (patch: Partial<ProductionSpec['environment']>) => dispatch({ type: 'root.patch', patch: { environment: { ...environment, ...patch } } });
  return <div className="director-form-grid">
    <label className="director-field director-field-wide"><span>Location</span><textarea aria-label="Environment location" rows={4} value={environment.locationDescription} onChange={event => update({ locationDescription: event.target.value })} /></label>
    <label className="director-field"><span>Time of day</span><input aria-label="Environment time of day" value={environment.timeOfDay} onChange={event => update({ timeOfDay: event.target.value })} /></label>
    <label className="director-field"><span>Lighting environment</span><input aria-label="Environment lighting" value={environment.lightingEnvironment} onChange={event => update({ lightingEnvironment: event.target.value })} /></label>
    <label className="director-field director-field-wide"><span>Weather / atmosphere</span><textarea aria-label="Environment atmosphere" rows={3} value={environment.weatherOrAtmosphere} onChange={event => update({ weatherOrAtmosphere: event.target.value })} /></label>
    <TextList label="Background constraints" value={environment.backgroundConstraints} onChange={backgroundConstraints => update({ backgroundConstraints })} />
    <TextList label="Environment reference asset IDs" value={environment.referenceAssetIds} onChange={referenceAssetIds => update({ referenceAssetIds })} />
  </div>;
}
