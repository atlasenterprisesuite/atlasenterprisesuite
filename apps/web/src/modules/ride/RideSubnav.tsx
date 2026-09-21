import { NavLink } from 'react-router-dom';

const destinations = [
  ['/ride', 'Ride'],
  ['/ride/driver', 'Driver / Partner'],
  ['/ride/readiness', 'Readiness'],
  ['/ride/driver/compliance', 'Compliance'],
  ['/ride/driver/compliance/documents', 'Documents & Credentials']
] as const;

export function RideSubnav() {
  return (
    <nav className="ride-subnav" aria-label="ATLAS Ride">
      {destinations.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/ride'}
          className={({ isActive }) => `ride-subnav-link${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
