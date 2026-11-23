/**
 * ATLAS Banking Calendar — read-only, source-scoped scheduling guidance.
 *
 * Sources (reviewed 2026-11-23):
 * - Federal Reserve Financial Services:
 *   https://www.frbservices.org/about/holiday-schedules/
 * - Chime, "Chime's 2026 Holiday Schedule" (2026-06-30):
 *   https://www.chime.com/blog/chime-holiday-bank-schedule/
 *
 * IMPORTANT: Chime is a financial technology company, not a bank.
 * Chime's public 2026 table omits Independence Day, unlike the Federal Reserve
 * table. Preserve the lists independently; do not infer a Chime-specific closure
 * from Fed data. This module never initiates, approves or guarantees a payment.
 * Product-specific cutoffs, payment rails and actual settlement may differ.
 */
export type BankingCalendarSource = 'federal_reserve' | 'chime';
export type BankingCalendarStatus = 'business_day' | 'non_business_day' | 'unknown';
export type BankingCalendarReason = 'scheduled_weekday' | 'holiday' | 'weekend' | 'source_date_not_covered';

export type BankingCalendarDay = {
  date: string;
  source: BankingCalendarSource;
  sourceUrl: string;
  status: BankingCalendarStatus;
  reason: BankingCalendarReason;
  holidayName: string | null;
  advisoryOnly: true;
};

export const BANKING_CALENDAR_SOURCES = {
  federal_reserve: 'https://www.frbservices.org/about/holiday-schedules/',
  chime: 'https://www.chime.com/blog/chime-holiday-bank-schedule/'
} as const;

const FEDERAL_RESERVE_HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Washington's Birthday",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-07-04': 'Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-10-12': 'Columbus Day',
  '2026-11-11': 'Veterans Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Washington's Birthday",
  '2027-05-31': 'Memorial Day',
  '2027-06-19': 'Juneteenth National Independence Day',
  '2027-07-04': 'Independence Day',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-10-11': 'Columbus Day',
  '2027-11-11': 'Veterans Day',
  '2027-11-25': 'Thanksgiving Day',
  '2027-12-25': 'Christmas Day'
};

const CHIME_PUBLISHED_HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "President's Day",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-10-12': "Indigenous Peoples' Day/Columbus Day",
  '2026-11-11': 'Veterans Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',
  '2027-01-01': "New Year's Day"
};

function parseDateOnly(date: string): Date {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Expected an ISO calendar date in YYYY-MM-DD format');
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid ISO calendar date');
  }
  return parsed;
}

/**
 * Returns an evidence-scoped classification, never a payment ETA or a provider
 * account status. Missing source coverage fails closed as unknown.
 */
export function getBankingCalendarDay(
  date: string,
  source: BankingCalendarSource
): BankingCalendarDay {
  const parsed = parseDateOnly(date);
  if (!(source in BANKING_CALENDAR_SOURCES)) {
    throw new Error('Unknown banking calendar source');
  }

  const covered = source === 'federal_reserve'
    ? date.slice(0, 4) === '2026' || date.slice(0, 4) === '2027'
    : date.slice(0, 4) === '2026' || date === '2027-01-01';
  const holidayName = (source === 'federal_reserve'
    ? FEDERAL_RESERVE_HOLIDAYS
    : CHIME_PUBLISHED_HOLIDAYS)[date] ?? null;
  const weekday = parsed.getUTCDay();
  const status: BankingCalendarStatus = !covered
    ? 'unknown'
    : holidayName || weekday === 0 || weekday === 6
      ? 'non_business_day'
      : 'business_day';
  const reason: BankingCalendarReason = !covered
    ? 'source_date_not_covered'
    : holidayName
      ? 'holiday'
      : weekday === 0 || weekday === 6
        ? 'weekend'
        : 'scheduled_weekday';

  return {
    date,
    source,
    sourceUrl: BANKING_CALENDAR_SOURCES[source],
    status,
    reason,
    holidayName: covered ? holidayName : null,
    advisoryOnly: true
  };
}

/**
 * Returns only the next calendar-classified business day, not the expected
 * posting date of a deposit. Returns null on an unknown source date.
 */
export function nextBankingBusinessDay(
  afterDate: string,
  source: BankingCalendarSource,
  maxLookaheadDays = 14
): string | null {
  const start = parseDateOnly(afterDate);
  if (!Number.isInteger(maxLookaheadDays) || maxLookaheadDays < 1 || maxLookaheadDays > 31) {
    throw new Error('Lookahead must be an integer from 1 to 31 days');
  }
  for (let offset = 1; offset <= maxLookaheadDays; offset += 1) {
    const next = new Date(start.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const assessment = getBankingCalendarDay(next, source);
    if (assessment.status === 'unknown') return null;
    if (assessment.status === 'business_day') return next;
  }
  return null;
}
