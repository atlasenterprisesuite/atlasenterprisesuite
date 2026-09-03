import { NavLink } from 'react-router-dom';

const base = '/health/research/frontiers/disease-reconstruction';

const items = [
  ['Overview', base, 'Lab overview'],
  ['Diseases', `${base}/diseases`, 'Disease workspaces'],
  ['Neural Graph', `${base}/neural-graph`, 'Mechanism graph navigation'],
  ['Evidence Registry', `${base}/evidence`, 'Evidence provenance navigation'],
  ['Falsification', `${base}/falsification`, 'Falsification workspace'],
  ['Vulnerability Engine', `${base}/vulnerability`, 'Reconstruction vulnerability workspace'],
  ['Curability Index', `${base}/curability`, 'Curability classification workspace'],
  ['Research Updates', `${base}/updates`, 'Research update workspace'],
  ['Settings', `${base}/settings`, 'Lab settings']
] as const;

export function LabNav() {
  return (
    <nav className="lab-nav" aria-label="Disease Reconstruction Lab">
      {items.map(([label, to, ariaLabel]) => (
        <NavLink
          key={to}
          to={to}
          aria-label={ariaLabel}
          end={to === base}
          className={({ isActive }) => isActive ? 'active' : undefined}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
