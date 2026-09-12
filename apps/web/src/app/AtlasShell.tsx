import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasPermission } from '../../../../packages/core/src';
import { AtlasAccessState } from './AtlasAccessState';
import { useAtlasContext, useAtlasSessionActions } from './AtlasContext';
import { ATLAS_MODULE_CATALOG } from './modules/moduleCatalog';

export function AtlasShell() {
  const identity = useAtlasContext();
  const session = useAtlasSessionActions();
  const location = useLocation();

  if (identity.status === 'authentication_required' && location.pathname.startsWith('/app')) {
    const target = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/identity?app=${target}`} replace />;
  }

  if (identity.status !== 'ready') {
    return <AtlasAccessState state={identity} />;
  }

  const visibleModules = ATLAS_MODULE_CATALOG.filter(
    (module) => !module.permissions
      || module.permissions.length === 0
      || module.permissions.some((permission) => hasPermission(identity.permissions, permission)),
  );

  return (
    <div className="atlas-shell">
      <aside className="atlas-shell__sidebar">
        <div className="atlas-shell__identity">
          <Link className="atlas-shell__brand" to="/app" aria-label="ATLAS Enterprise home">
            <span>ATLAS</span>
            <small>Enterprise Suite</small>
          </Link>
        </div>

        <nav className="atlas-shell__nav" aria-label="ATLAS modules">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              isActive ? 'atlas-shell__link atlas-shell__link--active' : 'atlas-shell__link'
            }
          >
            Enterprise
          </NavLink>
          {visibleModules.map((module) => (
            <NavLink
              key={module.id}
              to={module.route}
              className={({ isActive }) =>
                isActive ? 'atlas-shell__link atlas-shell__link--active' : 'atlas-shell__link'
              }
            >
              {module.displayName.replace(/^ATLAS /, '')}
            </NavLink>
          ))}
        </nav>

        <div className="atlas-shell__context" aria-label="Current ATLAS scope">
          <span>{identity.organizationName}</span>
          <small>{identity.userEmail || identity.userId}</small>
          <small>{identity.role}</small>
          <button className="atlas-shell__signout" type="button" onClick={() => void session.signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="atlas-shell__stage">
        <Outlet />
      </div>
    </div>
  );
}
