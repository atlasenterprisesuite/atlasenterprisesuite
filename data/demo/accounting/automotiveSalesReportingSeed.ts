import type {
  AutomotiveFloorplanPeriod,
  AutomotiveInventorySnapshot,
  AutomotiveReportingPeriod,
  AutomotiveSale,
  FixedOpsActivity
} from '../../../packages/accounting/src';

const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo' } as const;

export const automotiveReportingPeriod: AutomotiveReportingPeriod = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  sellingDays: 31
};

export const automotiveReportingDemoNotice =
  'DEMO DATA — deterministic automotive accounting fixtures for calculation and UI validation only. No DMS, lender, bank, OEM, CRM, POS, or Supabase production feed is connected.';

export const automotiveSales: AutomotiveSale[] = [
  {
    ...scope,
    id: 'sale-demo-001',
    storeId: 'store-demo-orlando',
    closedDate: '2026-08-05',
    stockNumber: 'DEMO-N1001',
    vin: 'DEMO-VIN-N1001',
    channel: 'new_retail',
    vehicleRevenue: 42000,
    inventoryCost: 38500,
    reconditioningCost: 0,
    transportationCost: 500,
    manufacturerCredits: {
      holdback: 800,
      floorplanAssistance: 450,
      advertisingAssistance: 250,
      incentives: 500,
      other: 0
    },
    fAndI: {
      financeReserveRevenue: 1200,
      serviceContractRevenue: 700,
      protectionProductRevenue: 400,
      otherRevenue: 0,
      chargebacks: 100
    },
    source: 'demo'
  },
  {
    ...scope,
    id: 'sale-demo-002',
    storeId: 'store-demo-orlando',
    closedDate: '2026-08-12',
    stockNumber: 'DEMO-N1002',
    vin: 'DEMO-VIN-N1002',
    channel: 'new_retail',
    vehicleRevenue: 50000,
    inventoryCost: 47000,
    reconditioningCost: 0,
    transportationCost: 600,
    manufacturerCredits: {
      holdback: 600,
      floorplanAssistance: 400,
      advertisingAssistance: 200,
      incentives: 400,
      other: 0
    },
    fAndI: {
      financeReserveRevenue: 1000,
      serviceContractRevenue: 500,
      protectionProductRevenue: 300,
      otherRevenue: 0,
      chargebacks: 0
    },
    source: 'demo'
  },
  {
    ...scope,
    id: 'sale-demo-003',
    storeId: 'store-demo-orlando',
    closedDate: '2026-08-19',
    stockNumber: 'DEMO-U2001',
    vin: 'DEMO-VIN-U2001',
    channel: 'used_retail',
    vehicleRevenue: 28000,
    inventoryCost: 23000,
    reconditioningCost: 1800,
    transportationCost: 200,
    manufacturerCredits: {
      holdback: 0,
      floorplanAssistance: 0,
      advertisingAssistance: 0,
      incentives: 0,
      other: 0
    },
    fAndI: {
      financeReserveRevenue: 1100,
      serviceContractRevenue: 700,
      protectionProductRevenue: 600,
      otherRevenue: 0,
      chargebacks: 300
    },
    source: 'demo'
  },
  {
    ...scope,
    id: 'sale-demo-004',
    storeId: 'store-demo-orlando',
    closedDate: '2026-08-25',
    stockNumber: 'DEMO-W3001',
    vin: 'DEMO-VIN-W3001',
    channel: 'used_wholesale',
    vehicleRevenue: 15000,
    inventoryCost: 14500,
    reconditioningCost: 0,
    transportationCost: 0,
    manufacturerCredits: {
      holdback: 0,
      floorplanAssistance: 0,
      advertisingAssistance: 0,
      incentives: 0,
      other: 0
    },
    fAndI: {
      financeReserveRevenue: 0,
      serviceContractRevenue: 0,
      protectionProductRevenue: 0,
      otherRevenue: 0,
      chargebacks: 0
    },
    source: 'demo'
  }
];

export const automotiveFixedOps: FixedOpsActivity[] = [
  {
    ...scope,
    id: 'fixed-demo-service',
    storeId: 'store-demo-orlando',
    activityDate: '2026-08-31',
    department: 'service',
    revenue: 25000,
    costOfSales: 10000,
    source: 'demo'
  },
  {
    ...scope,
    id: 'fixed-demo-parts',
    storeId: 'store-demo-orlando',
    activityDate: '2026-08-31',
    department: 'parts',
    revenue: 15000,
    costOfSales: 9000,
    source: 'demo'
  },
  {
    ...scope,
    id: 'fixed-demo-collision',
    storeId: 'store-demo-orlando',
    activityDate: '2026-08-31',
    department: 'collision',
    revenue: 10000,
    costOfSales: 7000,
    source: 'demo'
  }
];

export const automotiveInventorySnapshots: AutomotiveInventorySnapshot[] = [
  {
    ...scope,
    id: 'inventory-demo-new',
    storeId: 'store-demo-orlando',
    asOf: '2026-08-31',
    channel: 'new_retail',
    unitsOnHand: 2,
    inventoryCarryingValue: 80000,
    floorplanPayable: 76000,
    source: 'demo'
  },
  {
    ...scope,
    id: 'inventory-demo-used',
    storeId: 'store-demo-orlando',
    asOf: '2026-08-31',
    channel: 'used_retail',
    unitsOnHand: 1,
    inventoryCarryingValue: 25000,
    floorplanPayable: 20000,
    source: 'demo'
  }
];

export const automotiveFloorplanPeriods: AutomotiveFloorplanPeriod[] = [
  {
    ...scope,
    id: 'floorplan-demo-aug-2026',
    storeId: 'store-demo-orlando',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    interestExpense: 1200,
    source: 'demo'
  }
];
