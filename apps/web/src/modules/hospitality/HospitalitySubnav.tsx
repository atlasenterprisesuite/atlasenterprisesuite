import { NavLink } from 'react-router-dom';

const destinations = [
  ['/hospitality/access', 'Overview'],
  ['/hospitality/access/providers', 'Providers'],
  ['/hospitality/access/rooms', 'Rooms'],
  ['/hospitality/access/credentials', 'Credentials'],
  ['/hospitality/access/audit', 'Audit']
] as const;

export function HospitalitySubnav() {
  return (
    <nav className="hospitality-subnav" aria-label="Hospitality access">
      {destinations.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/hospitality/access'}
          className={({ isActive }) => isActive ? 'hospitality-subnav-link active' : 'hospitality-subnav-link'}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
