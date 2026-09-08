import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { PayrollPage } from './PayrollPage';

export function PeoplePayrollRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'payroll.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Payroll / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>payroll.read</code> permission.
        </p>
      </main>
    );
  }

  return <PayrollPage />;
}
