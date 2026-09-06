import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { SelfServicePage } from './SelfServicePage';

export function PeopleSelfServiceRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'payroll.self')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Self-Service / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This identity does not have the required <code>payroll.self</code> permission.
        </p>
      </main>
    );
  }

  return <SelfServicePage />;
}
