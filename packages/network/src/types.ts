export type CurrencyCode = string;

export type CnrInput = {
  cashCollectedMinor: number;
  taxesMinor: number;
  refundsMinor: number;
  chargebacksMinor: number;
  creditsMinor: number;
  passThroughFeesMinor: number;
};

export type CommissionComponent = 'direct' | 'level2' | 'level3' | 'leadership' | 'campaign';

export type CommissionRule = {
  component: CommissionComponent;
  rateBps: number;
  qualified: boolean;
};

export type CommissionPoolInput = {
  cnrMinor: number;
  contributionMarginMinor: number;
  productCommissionCapBps?: number | null;
};

export type CommissionAllocationInput = CommissionPoolInput & {
  rules: readonly CommissionRule[];
};

export type CommissionAllocation = {
  cnrMinor: number;
  poolCapMinor: number;
  allocatedMinor: number;
  retainedMinor: number;
  components: Readonly<Record<CommissionComponent, number>>;
};

export type NetworkLaunchPrice = {
  sku: string;
  productName: string;
  billing: 'monthly' | 'annual' | 'enrollment';
  unit: 'user' | 'organization' | 'seat' | 'partner';
  amountMinor: number;
  currency: 'USD';
  floorPrice: boolean;
};

export type NetworkPriceBookEntry = {
  productKey: string;
  billingInterval: 'monthly' | 'annual' | 'enrollment';
  currency: CurrencyCode;
  amountMinor: number;
  baseUsdAmountMinor: number;
  commissionable: boolean;
  productCommissionCapBps?: number | null;
  taxCode: string;
};
