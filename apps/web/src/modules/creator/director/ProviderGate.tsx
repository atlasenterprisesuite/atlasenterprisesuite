import type { Dispatch } from 'react';
import type { ProductionSpec, ProviderReadiness } from '../../../../../../packages/creator/types';
import { validateProductionSpec } from '../../../../../../packages/creator/validator';
import type { DirectorAction } from './directorState';

type ProviderGateProps = {
  providers: ProviderReadiness[];
  spec: ProductionSpec;
  dispatch: Dispatch<DirectorAction>;
  loading?: boolean;
  error?: string;
};

function capabilitySummary(provider: ProviderReadiness) {
  const capability = provider.capability;
  if (!capability) return null;
  const duration = capability.minDurationSeconds === null && capability.maxDurationSeconds === null
    ? 'Duration: not reported'
    : `Duration: ${capability.minDurationSeconds ?? 'any'}–${capability.maxDurationSeconds ?? 'any'}s`;
  return [
    `Modes: ${capability.modes.join(', ') || 'none reported'}`,
    duration,
    `Aspect ratios: ${capability.aspectRatios.join(', ') || 'none reported'}`,
    `Resolutions: ${capability.resolutions.join(', ') || 'none reported'}`,
    `Native audio: ${capability.audioSupport ? 'yes' : 'no'}`
  ];
}

export function ProviderGate({ providers, spec, dispatch, loading = false, error = '' }: ProviderGateProps) {
  if (loading) return <div className="director-inline-empty" role="status">Loading server provider readiness…</div>;
  if (error) return <div className="director-inline-empty" role="status">Provider readiness unavailable: {error}</div>;
  if (providers.length === 0) return <div className="director-inline-empty">No video providers are configured for this organization.</div>;

  return <div className="director-provider-list">
    {providers.map(provider => {
      const selected = spec.providerPreference === provider.providerId;
      const compatibility = provider.capability
        ? validateProductionSpec(spec, provider.capability).issues.filter(issue => issue.section === 'provider')
        : [];
      const summary = capabilitySummary(provider);
      return <article className={`director-provider-card ${selected ? 'selected' : ''}`} key={provider.providerId}>
        <div className="director-card-heading">
          <div>
            <p className="eyebrow">{provider.providerId}</p>
            <h3>{provider.displayName}</h3>
          </div>
          <button
            type="button"
            className="director-action secondary"
            aria-label={provider.displayName}
            aria-pressed={selected}
            onClick={() => dispatch({ type: 'provider.select', providerId: provider.providerId })}
          >{selected ? 'Selected' : 'Select'}</button>
        </div>
        <dl className="director-provider-facts">
          <div><dt>Connection state</dt><dd>{provider.connectionState}</dd></div>
          <div><dt>Last verified</dt><dd>{provider.lastVerifiedAt ? new Date(provider.lastVerifiedAt).toLocaleString() : 'Never verified'}</dd></div>
          <div><dt>Requested duration</dt><dd>{spec.durationSeconds}s</dd></div>
          <div><dt>Requested format</dt><dd>{spec.aspectRatio} · {spec.resolutionPreference} · audio {spec.audioEnabled ? 'on' : 'off'}</dd></div>
        </dl>
        {summary && <ul className="director-provider-capabilities" aria-label={`${provider.displayName} capability summary`}>
          {summary.map(item => <li key={item}>{item}</li>)}
        </ul>}
        {compatibility.length > 0 && <div className="director-provider-issues" aria-label={`${provider.displayName} compatibility issues`}>
          {compatibility.map(issue => <p key={`${issue.code}-${issue.targetId || 'root'}`}><strong>{issue.code}</strong> {issue.message}</p>)}
        </div>}
        {provider.estimatedCost !== null
          ? <div className="director-cost"><strong>Current server estimate</strong><pre>{JSON.stringify(provider.estimatedCost, null, 2)}</pre></div>
          : <p className="director-cost-unavailable">Cost estimate unavailable until provider configuration is verified.</p>}
      </article>;
    })}
  </div>;
}
