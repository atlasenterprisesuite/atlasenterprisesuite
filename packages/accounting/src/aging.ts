export type AgingItem = {
  dueDate: string | null;
  balanceDue: number | null;
};

export type AgingSummary = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) throw new Error(`Invalid accounting date: ${value}`);
  return timestamp;
}

export function calculateAging(items: readonly AgingItem[], asOfDate: string): AgingSummary {
  const asOf = parseDateOnly(asOfDate);
  const summary: AgingSummary = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
    total: 0,
  };

  for (const item of items) {
    const balance = Number(item.balanceDue ?? 0);
    if (!Number.isFinite(balance) || balance <= 0) continue;

    summary.total += balance;

    if (!item.dueDate) {
      summary.current += balance;
      continue;
    }

    const daysPastDue = Math.floor((asOf - parseDateOnly(item.dueDate)) / DAY_MS);
    if (daysPastDue <= 0) summary.current += balance;
    else if (daysPastDue <= 30) summary.days1to30 += balance;
    else if (daysPastDue <= 60) summary.days31to60 += balance;
    else if (daysPastDue <= 90) summary.days61to90 += balance;
    else summary.over90 += balance;
  }

  return summary;
}
