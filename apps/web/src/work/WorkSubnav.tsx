import { NavLink } from 'react-router-dom';

const items = [
  { to: '/work', label: 'Overview', end: true },
  { to: '/work/new', label: 'New work' },
  { to: '/work/active', label: 'Active' },
  { to: '/work/approvals', label: 'Approvals' },
  { to: '/work/history', label: 'History' },
  { to: '/work/connections', label: 'Connections' },
  { to: '/work/runtimes', label: 'Runtimes' },
  { to: '/work/policies', label: 'Policies' }
];

export function WorkSubnav() {
  return (
    <nav className="work-subnav" aria-label="ATLAS Work navigation">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
