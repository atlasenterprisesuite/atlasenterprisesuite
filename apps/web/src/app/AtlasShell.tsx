import { Link, NavLink, Outlet } from 'react-router-dom';
import { AtlasAccessState } from './AtlasAccessState';
import { useAtlasContext } from './AtlasContext';

const moduleLinks = [
  { to: '/', label: 'Enterprise', end: true },
  { to: '/finance', label: 'Finance', end: true },
  { to: '/finance/accounting', label: 'Accounting', end: true },
  { to: '/health', label: 'Health', end: false },
] as const;

export function AtlasShell() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') {
    return <AtlasAccessState state={identity} />;
  }

  return (
    <div className="atlas-shell">
      <aside className="atlas-shell__sidebar">
        <div className="atlas-shell__identity">
          <Link className="atlas-shell__brand" to="/" aria-label="ATLAS Enterprise home">
            ATLAS
          </Link>
        </div>

        <nav className="atlas-shell__nav" aria-label="ATLAS modules">
          {moduleLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'atlas-shell__link atlas-shell__link--active' : 'atlas-shell__link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="atlas-shell__context" aria-label="Current ATLAS scope">
          <span>{identity.organizationName}</span>
          <small>{identity.role}</small>
        </div>
      </aside>

      <div className="atlas-shell__stage">
        <Outlet />
      </div>
    </div>
  );
}
