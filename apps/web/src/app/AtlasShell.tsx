import { Link, NavLink, Outlet } from 'react-router-dom';
import { hasPermission, type AtlasPermission } from '../../../../packages/core/src';
import { AtlasAccessState } from './AtlasAccessState';
import { useAtlasContext } from './AtlasContext';

type ModuleLink = {
  to: string;
  label: string;
  end: boolean;
  permissions?: readonly AtlasPermission[];
};

const moduleLinks: readonly ModuleLink[] = [
  { to: '/', label: 'Enterprise', end: true },
  { to: '/finance', label: 'Finance', end: true },
  { to: '/finance/accounting', label: 'Accounting', end: true },
  { to: '/people', label: 'People', end: false, permissions: ['hr.read', 'hr.write', 'payroll.read', 'payroll.self'] },
  { to: '/operations', label: 'Operations', end: false, permissions: ['revenue.crm.read', 'revenue.sales.read', 'revenue.inventory.read', 'revenue.pos.read', 'revenue.projects.read'] },
  { to: '/automations', label: 'Automations', end: false, permissions: ['automation.read'] },
  { to: '/site-review', label: 'Site Review', end: false, permissions: ['site-review.read'] },
  { to: '/health', label: 'Health', end: false },
  { to: '/voice', label: 'Voice', end: false, permissions: ['voice.personal.read'] },
  { to: '/telecom/devices/mifi', label: 'Telecom', end: false, permissions: ['telecom.mifi.read'] },
];

export function AtlasShell() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') {
    return <AtlasAccessState state={identity} />;
  }

  const visibleModuleLinks = moduleLinks.filter(
    (item) => !item.permissions
      || item.permissions.some((permission) => hasPermission(identity.permissions, permission)),
  );

  return (
    <div className="atlas-shell">
      <aside className="atlas-shell__sidebar">
        <div className="atlas-shell__identity">
          <Link className="atlas-shell__brand" to="/" aria-label="ATLAS Enterprise home">
            ATLAS
          </Link>
        </div>

        <nav className="atlas-shell__nav" aria-label="ATLAS modules">
          {visibleModuleLinks.map((item) => (
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
