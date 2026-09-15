import { compileProviderRequest } from '../../../../../../packages/creator/compiler';
import { evaluateNativeRenderGate } from '../../../../../../packages/creator/native_policy';
import { hasCreatorPermission } from '../../../../../../packages/creator/permissions';
import type {
  CreatorPermission,
  ProductionSpec,
  ProviderReadiness,
  ValidationResult
} from '../../../../../../packages/creator/types';
import { validateProductionSpec } from '../../../../../../packages/creator/validator';

type ReviewPanelProps = {
  spec: ProductionSpec;
  providers: ProviderReadiness[];
  permissions: CreatorPermission[];
  validation: ValidationResult;
  dirty: boolean;
  submitting: boolean;
  nativeSubmitting: boolean;
  nativeReadinessState: 'loading' | 'ready' | 'error';
  nativeReadinessError: string;
  nativeCapabilities: string[];
  onSubmit: () => void;
  onNativeSubmit: () => void;
};

export function ReviewPanel({
  spec, providers, permissions, validation, dirty, submitting,
  nativeSubmitting, nativeReadinessState, nativeReadinessError, nativeCapabilities,
  onSubmit, onNativeSubmit
}: ReviewPanelProps) {
  const selectedProvider = spec.providerPreference
    ? providers.find(provider => provider.providerId === spec.providerPreference) || null
    : null;
  const selectedCapability = selectedProvider?.capability || null;
  const compiled = spec.providerPreference
    ? compileProviderRequest(spec, spec.providerPreference, selectedCapability || undefined)
    : null;
  const compatibility = selectedCapability
    ? validateProductionSpec(spec, selectedCapability).issues.filter(issue => issue.section === 'provider')
    : [];
  const canGenerate =
    hasCreatorPermission(permissions, 'creator.generate') &&
    selectedProvider?.connectionState === 'ready' &&
    validation.status !== 'blocking' &&
    !dirty &&
    !submitting;
  const nativeGate = evaluateNativeRenderGate({
    permissions,
    dirty,
    validationStatus: validation.status,
    aspectRatio: spec.aspectRatio === 'adaptive' ? '9:16' : spec.aspectRatio,
    audioEnabled: spec.audioEnabled,
    motionCompositionPresent: Boolean(spec.motionComposition),
    nativeCapabilities
  });
  const canNativeGenerate = nativeGate.allowed && nativeReadinessState === 'ready' && !nativeSubmitting;

  return <div className="director-review-stack">
    <section className={`director-review-card ${validation.status}`} aria-label="Final validation status">
      <div className="director-card-heading"><strong>Validation: {validation.status}</strong><span>{validation.issues.length} issue{validation.issues.length === 1 ? '' : 's'}</span></div>
      {validation.issues.length === 0
        ? <p>No deterministic production validation issues.</p>
        : validation.issues.map(issue => <p key={`${issue.code}-${issue.targetId || 'root'}`}><strong>{issue.code}</strong> — {issue.message}</p>)}
    </section>

    <section className="director-review-card" aria-label="ATLAS Native Composer">
      <div className="director-card-heading"><strong>ATLAS Native Composer</strong><span>{nativeReadinessState}</span></div>
      <p><strong>Zero-cost</strong> · self-hosted · local narration · burned captions · audio mix.</p>
      <p>No automatic fallback to paid media providers.</p>
      {nativeReadinessState === 'error' && <p><strong>Runtime:</strong> {nativeReadinessError || 'native_composer_unavailable'}</p>}
      {spec.motionComposition && <p><strong>Motion capability:</strong> {nativeCapabilities.includes('motion-composition-v1') ? 'verified' : 'not advertised by runtime'}</p>}
      {nativeGate.reasons.length > 0 && <ul>{nativeGate.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      <button className="director-action generate" type="button" disabled={!canNativeGenerate} onClick={onNativeSubmit}>
        {nativeSubmitting ? 'Rendering with ATLAS Native…' : 'Generate with ATLAS Native · $0'}
      </button>
    </section>

    {!compiled || !selectedProvider ? <div className="director-inline-empty">External provider generation is optional. Select one only when a verified provider is intentionally required.</div> : <>
      <section className="director-review-card" aria-label="Provider compatibility">
        <div className="director-card-heading"><strong>{selectedProvider.displayName}</strong><span>{selectedProvider.connectionState}</span></div>
        <p>Last verified: {selectedProvider.lastVerifiedAt ? new Date(selectedProvider.lastVerifiedAt).toLocaleString() : 'Never verified'}</p>
        {compatibility.length === 0
          ? <p>No capability conflicts reported by the verified capability contract.</p>
          : compatibility.map(issue => <p key={`${issue.code}-${issue.targetId || 'root'}`}><strong>{issue.code}</strong> — {issue.message}</p>)}
      </section>
      <label className="director-field director-field-wide">
        <span>Compiled provider prompt</span>
        <textarea aria-label="Compiled provider prompt" readOnly rows={16} value={compiled.prompt} />
      </label>
      <section className="director-review-card" aria-label="Normalized provider parameters">
        <h3>Normalized parameters</h3>
        <dl className="director-provider-facts">
          <div><dt>Duration</dt><dd>{compiled.normalizedParams.durationSeconds}s</dd></div>
          <div><dt>Aspect ratio</dt><dd>{compiled.normalizedParams.aspectRatio}</dd></div>
          <div><dt>Resolution</dt><dd>{compiled.normalizedParams.resolutionPreference}</dd></div>
          <div><dt>Audio</dt><dd>{compiled.normalizedParams.audioEnabled ? 'enabled' : 'disabled'}</dd></div>
          <div><dt>Readiness claim</dt><dd>{compiled.readinessClaim ? 'verified ready' : 'not verified ready'}</dd></div>
        </dl>
      </section>
      <section className="director-review-card" aria-label="Unsupported features and adaptation notes">
        <h3>Unsupported features</h3>
        {compiled.unsupportedFeatures.length ? <ul>{compiled.unsupportedFeatures.map(item => <li key={item}>{item}</li>)}</ul> : <p>None reported.</p>}
        <h3>Adaptation notes</h3>
        {compiled.adaptationNotes.length ? <ul>{compiled.adaptationNotes.map(item => <li key={item}>{item}</li>)}</ul> : <p>No automatic adaptations proposed.</p>}
      </section>
    </>}

    <button className="director-action generate" type="button" disabled={!canGenerate} onClick={onSubmit}>
      {submitting ? 'Submitting…' : 'Generate with verified external provider'}
    </button>
    <p className="director-context-note">Both render paths require creator.generate permission, a saved current version, and passing deterministic validation. Motion compositions additionally require the native runtime to advertise motion-composition-v1.</p>
  </div>;
}
