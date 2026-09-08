import { hasPermission, type AtlasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { TimeAttendancePage } from './TimeAttendancePage';

const PEOPLE_ACCESS_PERMISSIONS: readonly AtlasPermission[] = [
  'hr.read',
  'hr.write',
  'payroll.self',
];

export function PeopleTimeRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  const canAccess = PEOPLE_ACCESS_PERMISSIONS.some((permission) =>
    hasPermission(identity.permissions, permission),
  );

  if (!canAccess) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have an authorized People Operations permission.
        </p>
      </main>
    );
  }

  return <TimeAttendancePage />;
}
