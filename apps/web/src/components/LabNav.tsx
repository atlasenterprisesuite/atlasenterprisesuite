import { NavLink } from 'react-router-dom';

const base = '/health/research/frontiers/disease-reconstruction';
const items = [
  ['Overview', base],
  ['Diseases', `${base}/diseases`],
  ['Neural Graph', `${base}/neural-graph`],
  ['Evidence Registry', `${base}/evidence`],
  ['Falsification', `${base}/falsification`],
  ['Vulnerability Engine', `${base}/vulnerability`],
  ['Curability Index', `${base}/curability`],
  ['Jaque Mate + Sentinel', `${base}/jaque-mate-sentinel`],
  ['Research Updates', `${base}/updates`],
  ['Settings', `${base}/settings`]
] as const;

export function LabNav() {
  return (
    <nav className="lab-nav" aria-label="Disease Reconstruction Lab navigation">
      {items.map(([label, to]) => (
        <NavLink key={to} to={to} end={to === base}>{label}</NavLink>
      ))}
    </nav>
  );
}
