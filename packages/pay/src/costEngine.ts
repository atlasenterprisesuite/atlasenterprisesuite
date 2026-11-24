import { AtlasPayError } from './index';

export type AtlasCostBreakdown = {
  providerFixedMinor: bigint;
  providerVariableBps: bigint;
  providerCapMinor: bigint | null;
  expectedRiskMinor: bigint;
  allocatedOperationsMinor: bigint;
};

export type AtlasCostQuote = {
  amountMinor: bigint;
  totalCostMinor: bigint;
  customerFeeMinor: bigint;
  contributionMinor: bigint;
  meetsMargin: boolean;
};

/** Pure estimate only: never authorizes payment execution. Bps = 1/100 of one percent. */
export function quoteAtlasPaymentCost(
  amountMinor: bigint,
  costs: AtlasCostBreakdown,
  customerRateBps: bigint,
  minimumMarkupBps = 2000n
): AtlasCostQuote {
  const values = [
    costs.providerFixedMinor, costs.providerVariableBps,
    costs.expectedRiskMinor, costs.allocatedOperationsMinor,
    customerRateBps, minimumMarkupBps
  ];
  if (amountMinor <= 0n || values.some(value => value < 0n)
      || (costs.providerCapMinor !== null && costs.providerCapMinor < 0n)
      || customerRateBps > 10000n) {
    throw new AtlasPayError('ATLAS_PAY_INVALID_COST_INPUT');
  }
  // Round each variable charge upward to prevent optimistic underpricing.
  const variableMinor = (amountMinor * costs.providerVariableBps + 9999n) / 10000n;
  const providerMinor = costs.providerFixedMinor +
    (costs.providerCapMinor === null ? variableMinor :
      (variableMinor < costs.providerCapMinor ? variableMinor : costs.providerCapMinor));
  const totalCostMinor = providerMinor + costs.expectedRiskMinor + costs.allocatedOperationsMinor;
  const customerFeeMinor = (amountMinor * customerRateBps + 9999n) / 10000n;
  const contributionMinor = customerFeeMinor - totalCostMinor;
  return {
    amountMinor, totalCostMinor, customerFeeMinor, contributionMinor,
    meetsMargin: customerFeeMinor >=
      (totalCostMinor * (10000n + minimumMarkupBps) + 9999n) / 10000n
  };
}
