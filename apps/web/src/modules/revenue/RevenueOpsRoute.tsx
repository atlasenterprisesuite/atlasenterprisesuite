import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { RevenueOpsPage } from './RevenueOpsPage';

const REVENUE_READ_PERMISSIONS = [
  'revenue.crm.read',
  'revenue.sales.read',
  'revenue.purchasing.read',
  'revenue.inventory.read',
  'revenue.pos.read',
  'revenue.projects.read',
] as const;

export function RevenueOpsRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  const canReadRevenue = REVENUE_READ_PERMISSIONS.some((permission) =>
    hasPermission(identity.permissions, permission),
  );

  if (!canReadRevenue) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">Revenue Operations / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have an authorized Revenue Operations read permission.
        </p>
      </main>
    );
  }

  return <RevenueOpsPage />;
}
