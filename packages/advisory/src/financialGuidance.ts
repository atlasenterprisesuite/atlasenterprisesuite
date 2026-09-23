export type FinancialDataConfidence = 'confirmed' | 'estimated' | 'incomplete';

export type FinancialDebt = {
  id: string;
  name: string;
  balance: number;
  aprPercent?: number | null;
  minimumPayment?: number | null;
  cureAmount?: number | null;
  dueDate?: string | null;
  overdue?: boolean;
  collectionRiskDate?: string | null;
  securedEssential?: boolean;
};

export type FinancialGuidanceInput = {
  asOf: string;
  clientLabel?: string;
  dataConfidence: FinancialDataConfidence;
  availableCash: number;
  confirmedIncome30d: number;
  essentialExpenses30d: number;
  recurringObligations30d: number;
  debts: FinancialDebt[];
};

export type DebtPriority = {
  debtId: string;
  name: string;
  score: number;
  urgency: 'critical' | 'high' | 'normal';
  reasons: string[];
  planningTarget: number;
};

export type SuggestedPayment = {
  debtId: string;
  name: string;
  amount: number;
  rationale: string;
};

export type FinancialGuidanceResult = {
  asOf: string;
  totalDebt: number;
  minimumPayments30d: number;
  operatingReserveTarget: number;
  resources30d: number;
  protectedNeeds30d: number;
  allocatableCash: number;
  liquidityGap: number;
  dailyIncomeTargetToCloseGap: number;
  priorities: DebtPriority[];
  suggestedPayments: SuggestedPayment[];
  warnings: string[];
  methodology: string[];
};

function money(value: number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function daysBetween(asOf: string, date?: string | null) {
  if (!date) return null;
  const start = new Date(`${asOf}T00:00:00Z`).getTime();
  const end = new Date(`${date}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.ceil((end - start) / 86_400_000);
}

function classifyPriority(input: FinancialGuidanceInput, debt: FinancialDebt): DebtPriority {
  const reasons: string[] = [];
  let score = 0;

  const collectionDays = daysBetween(input.asOf, debt.collectionRiskDate);
  const dueDays = daysBetween(input.asOf, debt.dueDate);
  const apr = money(debt.aprPercent);

  if (collectionDays !== null && collectionDays <= 14) {
    score += collectionDays < 0 ? 130 : 110;
    reasons.push(collectionDays < 0 ? 'Collection-risk date has passed' : 'Collection risk within 14 days');
  }
  if (debt.overdue) {
    score += 85;
    reasons.push('Payment is overdue');
  }
  if (debt.securedEssential) {
    score += 60;
    reasons.push('Secured or essential obligation');
  }
  if (dueDays !== null && dueDays <= 7) {
    score += dueDays < 0 ? 55 : 40;
    reasons.push(dueDays < 0 ? 'Due date has passed' : 'Due within 7 days');
  }
  if (apr >= 25) {
    score += 50;
    reasons.push('Very high borrowing cost');
  } else if (apr >= 15) {
    score += 30;
    reasons.push('High borrowing cost');
  } else if (apr > 0) {
    score += 10;
    reasons.push('Interest-bearing balance');
  }

  const cure = money(debt.cureAmount);
  const minimum = money(debt.minimumPayment);
  const balance = money(debt.balance);
  const planningTarget = Math.min(balance, cure || minimum || 0);

  if (!planningTarget && (debt.overdue || collectionDays !== null)) {
    reasons.push('Amount needed to cure is not recorded');
  }

  return {
    debtId: debt.id,
    name: debt.name || 'Unnamed debt',
    score,
    urgency: score >= 100 ? 'critical' : score >= 60 ? 'high' : 'normal',
    reasons: reasons.length ? reasons : ['No immediate risk signal recorded'],
    planningTarget
  };
}

export function analyzeFinancialGuidance(input: FinancialGuidanceInput): FinancialGuidanceResult {
  const availableCash = money(input.availableCash);
  const income = money(input.confirmedIncome30d);
  const essentials = money(input.essentialExpenses30d);
  const recurring = money(input.recurringObligations30d);
  const debts = input.debts.filter((debt) => money(debt.balance) > 0);

  const totalDebt = debts.reduce((sum, debt) => sum + money(debt.balance), 0);
  const minimumPayments30d = debts.reduce((sum, debt) => sum + money(debt.minimumPayment), 0);
  const operatingReserveTarget = essentials > 0 ? essentials * (7 / 30) : 0;
  const resources30d = availableCash + income;
  const protectedNeeds30d = essentials + recurring + operatingReserveTarget;
  const allocatableCash = Math.max(0, resources30d - protectedNeeds30d);
  const liquidityGap = Math.max(0, essentials + recurring + minimumPayments30d - resources30d);
  const dailyIncomeTargetToCloseGap = liquidityGap > 0 ? liquidityGap / 30 : 0;

  const priorities = debts
    .map((debt) => classifyPriority(input, debt))
    .sort((a, b) => b.score - a.score || b.planningTarget - a.planningTarget);

  let remaining = allocatableCash;
  const suggestedPayments: SuggestedPayment[] = [];
  for (const priority of priorities) {
    if (remaining <= 0 || priority.planningTarget <= 0) continue;
    const amount = Math.min(remaining, priority.planningTarget);
    suggestedPayments.push({
      debtId: priority.debtId,
      name: priority.name,
      amount,
      rationale: priority.reasons[0]
    });
    remaining -= amount;
  }

  const warnings: string[] = [];
  if (input.dataConfidence !== 'confirmed') {
    warnings.push(input.dataConfidence === 'estimated'
      ? 'Some values are estimates; confirm balances, due dates and cure amounts before acting.'
      : 'The financial picture is incomplete; missing obligations can materially change the plan.');
  }
  if (debts.some((debt) => debt.overdue && !money(debt.cureAmount))) {
    warnings.push('At least one overdue debt has no cure amount. Confirm the amount required to become current.');
  }
  if (debts.some((debt) => daysBetween(input.asOf, debt.collectionRiskDate) !== null && !money(debt.cureAmount))) {
    warnings.push('At least one collection-risk debt has no recorded cure amount. Contact the creditor or servicer for the exact amount.');
  }
  if (resources30d < essentials + recurring) {
    warnings.push('Confirmed 30-day resources do not cover recorded essential and recurring needs.');
  }
  if (input.confirmedIncome30d === 0) {
    warnings.push('No confirmed 30-day income is recorded, so payment capacity may be understated.');
  }

  return {
    asOf: input.asOf,
    totalDebt,
    minimumPayments30d,
    operatingReserveTarget,
    resources30d,
    protectedNeeds30d,
    allocatableCash,
    liquidityGap,
    dailyIncomeTargetToCloseGap,
    priorities,
    suggestedPayments,
    warnings,
    methodology: [
      'Protect recorded essential expenses before discretionary debt acceleration.',
      'Hold a seven-day operating reserve target when essential-expense data is available.',
      'Escalate collection risk, overdue status and near-term due dates before ordinary APR optimization.',
      'Within similar urgency, give more weight to higher APR balances.',
      'Never invent missing balances, due dates, income or creditor cure amounts.'
    ]
  };
}
