import type { BillingMode, PayrollEntitlement } from './types';

export function resolvePayrollEntitlements(input: {
  billingMode: BillingMode;
  explicit: PayrollEntitlement[];
}): {
  capabilities: PayrollEntitlement[];
  softwareFeeExempt: boolean;
  externalProviderFeesWaived: false;
  publicPrice: null;
} {
  return {
    capabilities: [...new Set(input.explicit)],
    softwareFeeExempt: input.billingMode === 'internal_comp',
    externalProviderFeesWaived: false,
    publicPrice: null
  };
}
