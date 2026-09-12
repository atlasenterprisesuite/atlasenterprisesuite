import { sameScope, type TenantScope } from '../../core/src';

export type AutomotiveSalesChannel = 'new_retail' | 'used_retail' | 'used_wholesale';
export type FixedOpsDepartment = 'service' | 'parts' | 'collision';
export type AutomotiveDataSource = 'demo' | 'dms' | 'manual-import' | 'api';

export type ManufacturerCredits = {
  holdback: number;
  floorplanAssistance: number;
  advertisingAssistance: number;
  incentives: number;
  other: number;
};

export type FAndIBreakdown = {
  financeReserveRevenue: number;
  serviceContractRevenue: number;
  protectionProductRevenue: number;
  otherRevenue: number;
  chargebacks: number;
};

export type AutomotiveSale = TenantScope & {
  id: string;
  storeId: string;
  closedDate: string;
  stockNumber: string;
  vin: string;
  channel: AutomotiveSalesChannel;
  vehicleRevenue: number;
  inventoryCost: number;
  reconditioningCost: number;
  transportationCost: number;
  manufacturerCredits: ManufacturerCredits;
  fAndI: FAndIBreakdown;
  source: AutomotiveDataSource;
};

export type FixedOpsActivity = TenantScope & {
  id: string;
  storeId: string;
  activityDate: string;
  department: FixedOpsDepartment;
  revenue: number;
  costOfSales: number;
  source: AutomotiveDataSource;
};

export type AutomotiveInventorySnapshot = TenantScope & {
  id: string;
  storeId: string;
  asOf: string;
  channel: 'new_retail' | 'used_retail';
  unitsOnHand: number;
  inventoryCarryingValue: number;
  floorplanPayable: number;
  source: AutomotiveDataSource;
};

export type AutomotiveFloorplanPeriod = TenantScope & {
  id: string;
  storeId: string;
  startDate: string;
  endDate: string;
  interestExpense: number;
  source: AutomotiveDataSource;
};

export type AutomotiveReportingPeriod = {
  startDate: string;
  endDate: string;
  sellingDays: number;
};

export type AutomotiveSalesFilters = {
  query: string;
  channel: AutomotiveSalesChannel | 'all';
};

export type AutomotiveReportingInput = {
  scope: TenantScope;
  period: AutomotiveReportingPeriod;
  sales: readonly AutomotiveSale[];
  fixedOps: readonly FixedOpsActivity[];
  inventorySnapshots: readonly AutomotiveInventorySnapshot[];
  floorplanPeriods: readonly AutomotiveFloorplanPeriod[];
};

export type AutomotiveChannelSummary = {
  units: number;
  revenue: number;
  grossProfit: number;
  grossMargin: number | null;
  averageSellingPrice: number | null;
  grossProfitPerUnit: number | null;
};

const salesChannels: readonly AutomotiveSalesChannel[] = [
  'new_retail',
  'used_retail',
  'used_wholesale'
];

const fixedOpsDepartments: readonly FixedOpsDepartment[] = ['service', 'parts', 'collision'];

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function manufacturerCreditsTotal(credits: ManufacturerCredits) {
  return roundCurrency(
    credits.holdback +
      credits.floorplanAssistance +
      credits.advertisingAssistance +
      credits.incentives +
      credits.other
  );
}

export function netVehicleCost(sale: AutomotiveSale) {
  return roundCurrency(
    sale.inventoryCost +
      sale.reconditioningCost +
      sale.transportationCost -
      manufacturerCreditsTotal(sale.manufacturerCredits)
  );
}

export function vehicleGrossProfit(sale: AutomotiveSale) {
  return roundCurrency(sale.vehicleRevenue - netVehicleCost(sale));
}

export function netFAndIRevenue(sale: AutomotiveSale) {
  if (sale.channel === 'used_wholesale') return 0;
  return roundCurrency(
    sale.fAndI.financeReserveRevenue +
      sale.fAndI.serviceContractRevenue +
      sale.fAndI.protectionProductRevenue +
      sale.fAndI.otherRevenue -
      sale.fAndI.chargebacks
  );
}

export function fixedOpsGrossProfit(activity: FixedOpsActivity) {
  return roundCurrency(activity.revenue - activity.costOfSales);
}

function inPeriod(date: string, period: AutomotiveReportingPeriod) {
  return date >= period.startDate && date <= period.endDate;
}

export function scopeAutomotiveReportingData(input: AutomotiveReportingInput) {
  const { scope, period } = input;
  return {
    sales: input.sales.filter((sale) => sameScope(sale, scope) && inPeriod(sale.closedDate, period)),
    fixedOps: input.fixedOps.filter(
      (activity) => sameScope(activity, scope) && inPeriod(activity.activityDate, period)
    ),
    inventorySnapshots: input.inventorySnapshots.filter(
      (snapshot) => sameScope(snapshot, scope) && snapshot.asOf <= period.endDate
    ),
    floorplanPeriods: input.floorplanPeriods.filter(
      (item) =>
        sameScope(item, scope) &&
        item.endDate >= period.startDate &&
        item.startDate <= period.endDate
    )
  };
}

export function filterAutomotiveSales(
  sales: readonly AutomotiveSale[],
  filters: AutomotiveSalesFilters
) {
  const query = filters.query.trim().toLowerCase();
  return sales.filter((sale) => {
    const matchesChannel = filters.channel === 'all' || sale.channel === filters.channel;
    const matchesQuery =
      !query ||
      sale.stockNumber.toLowerCase().includes(query) ||
      sale.vin.toLowerCase().includes(query) ||
      sale.storeId.toLowerCase().includes(query);
    return matchesChannel && matchesQuery;
  });
}

function summarizeChannel(
  sales: readonly AutomotiveSale[],
  channel: AutomotiveSalesChannel
): AutomotiveChannelSummary {
  const rows = sales.filter((sale) => sale.channel === channel);
  const revenue = rows.reduce((sum, sale) => sum + sale.vehicleRevenue, 0);
  const grossProfit = rows.reduce((sum, sale) => sum + vehicleGrossProfit(sale), 0);
  const units = rows.length;
  return {
    units,
    revenue: roundCurrency(revenue),
    grossProfit: roundCurrency(grossProfit),
    grossMargin: percentage(grossProfit, revenue),
    averageSellingPrice: units === 0 ? null : roundCurrency(revenue / units),
    grossProfitPerUnit: units === 0 ? null : roundCurrency(grossProfit / units)
  };
}

function summarizeFixedOps(
  fixedOps: readonly FixedOpsActivity[],
  department: FixedOpsDepartment
) {
  const rows = fixedOps.filter((item) => item.department === department);
  const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
  const grossProfit = rows.reduce((sum, item) => sum + fixedOpsGrossProfit(item), 0);
  return {
    revenue: roundCurrency(revenue),
    grossProfit: roundCurrency(grossProfit),
    grossMargin: percentage(grossProfit, revenue)
  };
}

function latestInventorySnapshot(
  snapshots: readonly AutomotiveInventorySnapshot[],
  channel: 'new_retail' | 'used_retail'
) {
  return [...snapshots]
    .filter((snapshot) => snapshot.channel === channel)
    .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
}

function inventorySummary(
  snapshots: readonly AutomotiveInventorySnapshot[],
  channel: 'new_retail' | 'used_retail',
  unitsSold: number,
  sellingDays: number
) {
  const snapshot = latestInventorySnapshot(snapshots, channel);
  if (!snapshot) {
    return {
      asOf: null,
      unitsOnHand: null,
      inventoryCarryingValue: null,
      floorplanPayable: null,
      daysSupply: null
    };
  }
  const averageDailyUnits = sellingDays > 0 ? unitsSold / sellingDays : 0;
  return {
    asOf: snapshot.asOf,
    unitsOnHand: snapshot.unitsOnHand,
    inventoryCarryingValue: roundCurrency(snapshot.inventoryCarryingValue),
    floorplanPayable: roundCurrency(snapshot.floorplanPayable),
    daysSupply:
      averageDailyUnits > 0
        ? Number((snapshot.unitsOnHand / averageDailyUnits).toFixed(1))
        : null
  };
}

export function summarizeAutomotiveReporting(input: AutomotiveReportingInput) {
  const scoped = scopeAutomotiveReportingData(input);
  const channels = Object.fromEntries(
    salesChannels.map((channel) => [channel, summarizeChannel(scoped.sales, channel)])
  ) as Record<AutomotiveSalesChannel, AutomotiveChannelSummary>;

  const fixedOps = Object.fromEntries(
    fixedOpsDepartments.map((department) => [department, summarizeFixedOps(scoped.fixedOps, department)])
  ) as Record<
    FixedOpsDepartment,
    { revenue: number; grossProfit: number; grossMargin: number | null }
  >;

  const retailSales = scoped.sales.filter((sale) => sale.channel !== 'used_wholesale');
  const retailUnits = retailSales.length;
  const vehicleRevenue = scoped.sales.reduce((sum, sale) => sum + sale.vehicleRevenue, 0);
  const vehicleGross = scoped.sales.reduce((sum, sale) => sum + vehicleGrossProfit(sale), 0);
  const fAndINetRevenue = retailSales.reduce((sum, sale) => sum + netFAndIRevenue(sale), 0);
  const fAndIChargebacks = retailSales.reduce((sum, sale) => sum + sale.fAndI.chargebacks, 0);
  const fixedOpsRevenue = Object.values(fixedOps).reduce((sum, item) => sum + item.revenue, 0);
  const fixedOpsGross = Object.values(fixedOps).reduce((sum, item) => sum + item.grossProfit, 0);
  const manufacturerCredits = scoped.sales.reduce(
    (sum, sale) => sum + manufacturerCreditsTotal(sale.manufacturerCredits),
    0
  );
  const floorplanAssistance = scoped.sales.reduce(
    (sum, sale) => sum + sale.manufacturerCredits.floorplanAssistance,
    0
  );
  const floorplanInterestExpense = scoped.floorplanPeriods.reduce(
    (sum, item) => sum + item.interestExpense,
    0
  );
  const totalRevenue = vehicleRevenue + fixedOpsRevenue + fAndINetRevenue;
  const totalGrossProfit = vehicleGross + fixedOpsGross + fAndINetRevenue;

  return {
    channels,
    fixedOps,
    retailUnits,
    vehicleRevenue: roundCurrency(vehicleRevenue),
    vehicleGrossProfit: roundCurrency(vehicleGross),
    fAndINetRevenue: roundCurrency(fAndINetRevenue),
    fAndIChargebacks: roundCurrency(fAndIChargebacks),
    fAndIPerRetailUnit:
      retailUnits === 0 ? null : roundCurrency(fAndINetRevenue / retailUnits),
    fixedOpsRevenue: roundCurrency(fixedOpsRevenue),
    fixedOpsGrossProfit: roundCurrency(fixedOpsGross),
    manufacturerCredits: roundCurrency(manufacturerCredits),
    floorplanAssistance: roundCurrency(floorplanAssistance),
    floorplanInterestExpense: roundCurrency(floorplanInterestExpense),
    netInventoryCarryingCost: roundCurrency(floorplanInterestExpense - floorplanAssistance),
    totalRevenue: roundCurrency(totalRevenue),
    totalGrossProfit: roundCurrency(totalGrossProfit),
    totalGrossMargin: percentage(totalGrossProfit, totalRevenue),
    inventory: {
      new: inventorySummary(
        scoped.inventorySnapshots,
        'new_retail',
        channels.new_retail.units,
        input.period.sellingDays
      ),
      used: inventorySummary(
        scoped.inventorySnapshots,
        'used_retail',
        channels.used_retail.units,
        input.period.sellingDays
      )
    }
  };
}
