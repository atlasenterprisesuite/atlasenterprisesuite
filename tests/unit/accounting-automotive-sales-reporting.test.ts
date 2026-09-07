import { describe, expect, it } from 'vitest';
import {
  filterAutomotiveSales,
  netFAndIRevenue,
  netVehicleCost,
  summarizeAutomotiveReporting,
  vehicleGrossProfit
} from '../../packages/accounting/src';
import { demoAtlasContext } from '../../packages/core/src';
import {
  automotiveFixedOps,
  automotiveFloorplanPeriods,
  automotiveInventorySnapshots,
  automotiveReportingPeriod,
  automotiveSales
} from '../../data/demo/accounting/automotiveSalesReportingSeed';

const input = {
  scope: demoAtlasContext.scope,
  period: automotiveReportingPeriod,
  sales: automotiveSales,
  fixedOps: automotiveFixedOps,
  inventorySnapshots: automotiveInventorySnapshots,
  floorplanPeriods: automotiveFloorplanPeriods
};

describe('automotive sales financial reporting', () => {
  it('computes deal economics with manufacturer credits and F&I chargebacks', () => {
    expect(netVehicleCost(automotiveSales[0])).toBe(37000);
    expect(vehicleGrossProfit(automotiveSales[0])).toBe(5000);
    expect(netFAndIRevenue(automotiveSales[0])).toBe(2200);
  });

  it('builds one departmental report from the governed period dataset', () => {
    const report = summarizeAutomotiveReporting(input);
    expect(report.channels.new_retail).toMatchObject({ units: 2, revenue: 92000, grossProfit: 9000 });
    expect(report.channels.used_retail).toMatchObject({ units: 1, revenue: 28000, grossProfit: 3000 });
    expect(report.channels.used_wholesale).toMatchObject({ units: 1, revenue: 15000, grossProfit: 500 });
    expect(report.fAndINetRevenue).toBe(6100);
    expect(report.fAndIChargebacks).toBe(400);
    expect(report.fAndIPerRetailUnit).toBe(2033.33);
    expect(report.fixedOpsRevenue).toBe(50000);
    expect(report.fixedOpsGrossProfit).toBe(24000);
    expect(report.totalRevenue).toBe(191100);
    expect(report.totalGrossProfit).toBe(42600);
  });

  it('reconciles floorplan assistance to carrying cost analytics without adding it twice to total gross', () => {
    const report = summarizeAutomotiveReporting(input);
    expect(report.manufacturerCredits).toBe(3600);
    expect(report.floorplanAssistance).toBe(850);
    expect(report.floorplanInterestExpense).toBe(1200);
    expect(report.netInventoryCarryingCost).toBe(350);
    expect(report.inventory.new.daysSupply).toBe(31);
    expect(report.inventory.used.daysSupply).toBe(31);
  });

  it('filters deal detail without changing the governed report source', () => {
    expect(filterAutomotiveSales(automotiveSales, { query: 'u2001', channel: 'all' })).toHaveLength(1);
    expect(filterAutomotiveSales(automotiveSales, { query: '', channel: 'new_retail' })).toHaveLength(2);
  });

  it('excludes another tenant from report totals', () => {
    const foreignSale = { ...automotiveSales[0], id: 'foreign', tenantId: 'tenant-other', vehicleRevenue: 999999 };
    const report = summarizeAutomotiveReporting({ ...input, sales: [...automotiveSales, foreignSale] });
    expect(report.totalRevenue).toBe(191100);
  });
});
