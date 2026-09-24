import { applyBasisPoints } from './money';
import type {
  CommissionAllocation,
  CommissionAllocationInput,
  CommissionComponent,
  CommissionPoolInput,
  CommissionRule
} from './types';

const COMPONENT_ORDER: readonly CommissionComponent[] = ['direct', 'level2', 'level3', 'leadership', 'campaign'];

const COMPONENT_MAX_BPS: Readonly<Record<CommissionComponent, number>> = {
  direct: 1200,
  level2: 300,
  level3: 150,
  leadership: 150,
  campaign: 200
};

export function validateCommissionRules(rules: readonly CommissionRule[], poolCapBps = 2000): void {
  if (!Number.isInteger(poolCapBps) || poolCapBps < 0 || poolCapBps > 2000) {
    throw new Error('poolCapBps must be an integer from 0 to 2000');
  }

  const seen = new Set<CommissionComponent>();
  let aggregateBps = 0;

  for (const rule of rules) {
    if (seen.has(rule.component)) throw new Error(`duplicate commission component: ${rule.component}`);
    seen.add(rule.component);
    if (!Number.isInteger(rule.rateBps) || rule.rateBps < 0) throw new Error('commission rate must be a non-negative integer');
    if (rule.rateBps > COMPONENT_MAX_BPS[rule.component]) throw new Error(`${rule.component} exceeds the approved launch maximum`);
    aggregateBps += rule.rateBps;
  }

  if (aggregateBps > poolCapBps) throw new Error('aggregate commission rate exceeds the pool cap');
}

export function calculateCommissionPoolCapMinor(input: CommissionPoolInput): number {
  const { cnrMinor, contributionMarginMinor, productCommissionCapBps } = input;
  if (!Number.isSafeInteger(cnrMinor) || !Number.isSafeInteger(contributionMarginMinor)) {
    throw new Error('CNR and contribution margin must be safe integer minor units');
  }
  if (productCommissionCapBps != null && (!Number.isInteger(productCommissionCapBps) || productCommissionCapBps < 0 || productCommissionCapBps > 2000)) {
    throw new Error('product commission cap must be between 0 and 2000 bps');
  }
  if (cnrMinor <= 0 || contributionMarginMinor <= 0) return 0;

  const revenueCap = applyBasisPoints(cnrMinor, Math.min(2000, productCommissionCapBps ?? 2000));
  const marginCap = applyBasisPoints(contributionMarginMinor, 3500);
  return Math.max(0, Math.min(revenueCap, marginCap));
}

export function calculateCommissionAllocation(input: CommissionAllocationInput): CommissionAllocation {
  validateCommissionRules(input.rules);

  const poolCapMinor = calculateCommissionPoolCapMinor(input);
  const components: Record<CommissionComponent, number> = {
    direct: 0,
    level2: 0,
    level3: 0,
    leadership: 0,
    campaign: 0
  };

  if (poolCapMinor === 0) {
    return { cnrMinor: input.cnrMinor, poolCapMinor, allocatedMinor: 0, retainedMinor: 0, components };
  }

  const nominal = new Map<CommissionComponent, number>();
  let nominalTotal = 0;
  for (const rule of input.rules) {
    const amount = rule.qualified ? Math.max(0, applyBasisPoints(input.cnrMinor, rule.rateBps)) : 0;
    nominal.set(rule.component, amount);
    nominalTotal += amount;
  }

  if (nominalTotal <= poolCapMinor) {
    for (const component of COMPONENT_ORDER) components[component] = nominal.get(component) ?? 0;
    return {
      cnrMinor: input.cnrMinor,
      poolCapMinor,
      allocatedMinor: nominalTotal,
      retainedMinor: poolCapMinor - nominalTotal,
      components
    };
  }

  let allocatedMinor = 0;
  for (const component of COMPONENT_ORDER) {
    const amount = nominal.get(component) ?? 0;
    if (amount === 0) continue;
    const scaled = Math.floor((amount * poolCapMinor) / nominalTotal);
    components[component] = scaled;
    allocatedMinor += scaled;
  }

  let remainder = poolCapMinor - allocatedMinor;
  for (const component of COMPONENT_ORDER) {
    if (remainder <= 0) break;
    if ((nominal.get(component) ?? 0) <= 0) continue;
    components[component] += 1;
    allocatedMinor += 1;
    remainder -= 1;
  }

  return {
    cnrMinor: input.cnrMinor,
    poolCapMinor,
    allocatedMinor,
    retainedMinor: poolCapMinor - allocatedMinor,
    components
  };
}
