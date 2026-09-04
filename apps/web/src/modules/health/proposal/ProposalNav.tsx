import { NavLink } from 'react-router-dom';
import { proposalSections } from './proposalContent';

export function ProposalNav() {
  return <nav className="health-subnav" aria-label="Proposal sections">{proposalSections.map(section => <NavLink key={section.id} to={`/health/proposal/adventhealth/${section.id}`} className={({ isActive }) => isActive ? 'active' : ''}>{section.title}</NavLink>)}</nav>;
}
