import { NavLink } from 'react-router-dom';
import { proposalSections } from './proposalContent';

export function ProposalNav() {
  return (
    <nav aria-label="Proposal sections" className="proposal-nav">
      {proposalSections.map((section) => (
        <NavLink
          key={section.id}
          data-testid="proposal-section-link"
          to={`/health/proposal/adventhealth/${section.id}`}
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          {section.title}
        </NavLink>
      ))}
    </nav>
  );
}
