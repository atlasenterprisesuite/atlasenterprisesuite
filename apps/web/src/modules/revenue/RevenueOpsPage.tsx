import { useEffect, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useRevenueOpsRepository } from './RevenueOpsDataProvider';

type RevenueSnapshot = {
  crmAccounts: number | null;
  opportunities: number | null;
  salesOrders: number | null;
  vendors: number | null;
  purchaseOrders: number | null;
  inventoryItems: number | null;
  posTransactions: number | null;
  projects: number | null;
};

const EMPTY_SNAPSHOT: RevenueSnapshot = {
  crmAccounts: null,
  opportunities: null,
  salesOrders: null,
  vendors: null,
  purchaseOrders: null,
  inventoryItems: null,
  posTransactions: null,
  projects: null,
};

function displayCount(value: number | null, label: string) {
  return value === null ? 'Loading…' : `${value} ${label}`;
}

export function RevenueOpsPage() {
  const identity = useAtlasContext();
  const repository = useRevenueOpsRepository();
  const [snapshot, setSnapshot] = useState<RevenueSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);

  const ready = identity.status === 'ready';
  const tenantId = ready ? identity.tenantId : '';
  const organizationId = ready ? identity.organizationId : '';
  const permissions = ready ? identity.permissions : [];

  const canReadCrm = hasPermission(permissions, 'revenue.crm.read');
  const canReadSales = hasPermission(permissions, 'revenue.sales.read');
  const canReadPurchasing = hasPermission(permissions, 'revenue.purchasing.read');
  const canReadInventory = hasPermission(permissions, 'revenue.inventory.read');
  const canReadPos = hasPermission(permissions, 'revenue.pos.read');
  const canReadProjects = hasPermission(permissions, 'revenue.projects.read');

  useEffect(() => {
    if (!ready || !repository) return;

    let active = true;
    const scope = { tenantId, organizationId };

    const load = async () => {
      try {
        const [crm, sales, purchasing, inventory, pos, projects] = await Promise.all([
          canReadCrm
            ? Promise.all([repository.listAccounts(scope), repository.listOpportunities(scope)])
            : Promise.resolve(null),
          canReadSales ? repository.listSalesOrders(scope) : Promise.resolve(null),
          canReadPurchasing
            ? Promise.all([repository.listVendors(scope), repository.listPurchaseOrders(scope)])
            : Promise.resolve(null),
          canReadInventory ? repository.listInventoryItems(scope) : Promise.resolve(null),
          canReadPos ? repository.listPosTransactions(scope) : Promise.resolve(null),
          canReadProjects ? repository.listProjects(scope) : Promise.resolve(null),
        ]);

        if (!active) return;
        setSnapshot({
          crmAccounts: crm ? crm[0].length : null,
          opportunities: crm ? crm[1].length : null,
          salesOrders: sales ? sales.length : null,
          vendors: purchasing ? purchasing[0].length : null,
          purchaseOrders: purchasing ? purchasing[1].length : null,
          inventoryItems: inventory ? inventory.length : null,
          posTransactions: pos ? pos.length : null,
          projects: projects ? projects.length : null,
        });
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Revenue Operations data could not be loaded');
      }
    };

    void load();
    return () => { active = false; };
  }, [
    ready,
    repository,
    tenantId,
    organizationId,
    canReadCrm,
    canReadSales,
    canReadPurchasing,
    canReadInventory,
    canReadPos,
    canReadProjects,
  ]);

  if (!ready) return null;

  return (
    <main className="atlas-page atlas-module-page revenue-ops-page">
      <p className="atlas-eyebrow">ATLAS Operations</p>
      <h1>Revenue Operations</h1>
      <p className="atlas-page__lede">
        One governed operational layer for customer relationships, sales, purchasing, inventory, point of sale and projects, scoped to the current tenant and organization.
      </p>

      {!repository && (
        <section className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Data source</strong>
          <span>Revenue Ops repository: Not configured</span>
        </section>
      )}

      {error && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Data unavailable</strong>
          <span>{error}</span>
        </section>
      )}

      <div className="atlas-card-grid">
        {canReadCrm && (
          <article className="atlas-status-panel">
            <strong>CRM</strong>
            <span>{displayCount(snapshot.crmAccounts, 'accounts')} • {displayCount(snapshot.opportunities, 'opportunities')}</span>
          </article>
        )}
        {canReadSales && (
          <article className="atlas-status-panel">
            <strong>Sales</strong>
            <span>{displayCount(snapshot.salesOrders, 'sales orders')}</span>
          </article>
        )}
        {canReadPurchasing && (
          <article className="atlas-status-panel">
            <strong>Vendors & Purchasing</strong>
            <span>{displayCount(snapshot.vendors, 'vendors')} • {displayCount(snapshot.purchaseOrders, 'purchase orders')}</span>
            <span>Operational receiving does not create Accounts Payable automatically.</span>
          </article>
        )}
        {canReadInventory && (
          <article className="atlas-status-panel">
            <strong>Inventory</strong>
            <span>{displayCount(snapshot.inventoryItems, 'items')}</span>
          </article>
        )}
        {canReadPos && (
          <article className="atlas-status-panel">
            <strong>Point of Sale</strong>
            <span>{displayCount(snapshot.posTransactions, 'transactions')}</span>
          </article>
        )}
        {canReadProjects && (
          <article className="atlas-status-panel">
            <strong>Projects</strong>
            <span>{displayCount(snapshot.projects, 'projects')}</span>
          </article>
        )}
      </div>
    </main>
  );
}
