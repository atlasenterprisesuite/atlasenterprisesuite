import { NavLink } from 'react-router-dom';

const destinations = [
  ['/hospitality/overview', 'Overview'],
  ['/hospitality/properties', 'Properties'],
  ['/hospitality/access', 'Room Access'],
  ['/hospitality/access/providers', 'Providers'],
  ['/hospitality/access/rooms', 'Rooms'],
  ['/hospitality/access/credentials', 'Credentials'],
  ['/hospitality/access/audit', 'Audit']
] as const;

export function HospitalitySubnav() {
  return (
    <nav className="hospitality-subnav" aria-label="Hospitality OS">
      {destinations.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/hospitality/overview' || to === '/hospitality/properties' || to === '/hospitality/access'}
          className={({ isActive }) => isActive ? 'hospitality-subnav-link active' : 'hospitality-subnav-link'}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
