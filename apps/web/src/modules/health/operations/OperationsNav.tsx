import { NavLink } from 'react-router-dom';

const operationLinks = [
  { to: '/health/operations/command-center', label: 'Command Center' },
  { to: '/health/operations/modules', label: 'Modules' }
];

export function OperationsNav() {
  return (
    <nav aria-label="Health operations" className="proposal-nav">
      {operationLinks.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
