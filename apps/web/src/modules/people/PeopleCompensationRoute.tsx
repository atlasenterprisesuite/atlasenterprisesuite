import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { CompensationPage } from './CompensationPage';

export function PeopleCompensationRoute() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'payroll.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Compensation</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">payroll.read permission is required to access Compensation management.</p>
      </main>
    );
  }

  return <CompensationPage />;
}
