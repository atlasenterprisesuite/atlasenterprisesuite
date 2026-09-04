import type { ProposalSection } from './proposalContent';

export function ProposalSectionPage({ section }: { section: ProposalSection }) {
  return (
    <article className="page-stack proposal-section-page">
      <header className="page-header">
        <p className="eyebrow">AdventHealth Proposal</p>
        <h1>{section.title}</h1>
        <p>{section.body}</p>
      </header>
      {section.id === 'pilot' && (
        <div className="notice">
          Pilot sequence is illustrative. Scope, baselines, targets, integrations, owners, timelines, and success criteria require joint validation before commitment.
        </div>
      )}
      {section.id === 'kpis' && (
        <div className="notice">
          No production KPI is asserted here. Targets become valid only after authorized data sources establish a baseline.
        </div>
      )}
      {section.id === 'integrations' && (
        <div className="connection-gate">
          <strong>Authorization gate</strong>
          <span>Adapters remain configured/demo/unavailable until credentials, permissions, health checks, and source verification establish a true live state.</span>
        </div>
      )}
    </article>
  );
}
