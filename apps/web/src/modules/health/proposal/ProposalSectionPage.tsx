import type { ProposalSectionId } from './proposalContent';

export function ProposalSectionPage({ section }: { section: { id: ProposalSectionId; title: string; kicker: string; body: string; points: string[] } }) {
  return <article className="proposal-section"><p className="eyebrow">{section.kicker}</p><h1>{section.title}</h1><p className="proposal-lead">{section.body}</p><div className="proposal-point-grid">{section.points.map((point, index) => <div key={point}><span>0{index + 1}</span><strong>{point}</strong></div>)}</div></article>;
}
