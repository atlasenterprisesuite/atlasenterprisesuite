import { compileProviderRequest } from '../../../../../../packages/creator/compiler';
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
  submitting: boolean;
  onSubmit: () => void;
};

export function ReviewPanel({ spec, providers, permissions, validation, submitting, onSubmit }: ReviewPanelProps) {
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
    !submitting;

  return <div className="director-review-stack">
    <section className={`director-review-card ${validation.status}`} aria-label="Final validation status">
      <div className="director-card-heading"><strong>Validation: {validation.status}</strong><span>{validation.issues.length} issue{validation.issues.length === 1 ? '' : 's'}</span></div>
      {validation.issues.length === 0
        ? <p>No deterministic production validation issues.</p>
        : validation.issues.map(issue => <p key={`${issue.code}-${issue.targetId || 'root'}`}><strong>{issue.code}</strong> — {issue.message}</p>)}
    </section>

    {!compiled || !selectedProvider ? <div className="director-inline-empty">Select a provider to compile a provider request.</div> : <>
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
      {submitting ? 'Submitting…' : 'Generate video'}
    </button>
    <p className="director-context-note">Generation requires creator.generate permission, passing deterministic validation, and a server-verified ready provider.</p>
  </div>;
}
