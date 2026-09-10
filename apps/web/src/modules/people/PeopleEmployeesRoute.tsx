import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { EmployeesPage } from './EmployeesPage';

export function PeopleEmployeesRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  const canReadEmployees = hasPermission(identity.permissions, 'hr.read')
    || hasPermission(identity.permissions, 'hr.write');

  if (!canReadEmployees) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Employees / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have an authorized HR permission.
        </p>
      </main>
    );
  }

  return <EmployeesPage />;
}
