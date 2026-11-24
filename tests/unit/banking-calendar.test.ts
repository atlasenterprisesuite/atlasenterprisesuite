import { describe, expect, it } from 'vitest';
import { getBankingCalendarDay, nextBankingBusinessDay } from '../../packages/core/src/bankingCalendar';

describe('ATLAS bank calendar — source-specific, advisory-only', () => {
  it('uses the published Chime 2026 holiday list for Thanksgiving', () => {
    expect(getBankingCalendarDay('2026-11-26', 'chime')).toMatchObject({
      status: 'non_business_day',
      reason: 'holiday',
      holidayName: 'Thanksgiving Day',
      advisoryOnly: true
    });
    expect(nextBankingBusinessDay('2026-11-26', 'chime')).toBe('2026-11-27');
  });

  it('keeps a missing Chime listing distinct from Federal Reserve holidays', () => {
    // Chime's 2026 article does not list Independence Day; Saturday is still a weekend.
    expect(getBankingCalendarDay('2026-07-04', 'chime')).toMatchObject({
      status: 'non_business_day',
      reason: 'weekend',
      holidayName: null
    });
    expect(getBankingCalendarDay('2026-07-04', 'federal_reserve')).toMatchObject({
      status: 'non_business_day',
      reason: 'holiday',
      holidayName: 'Independence Day'
    });
  });

  it('observes a Sunday Federal Reserve holiday on Monday, not the preceding Friday', () => {
    expect(getBankingCalendarDay('2027-07-05', 'federal_reserve')).toMatchObject({
      status: 'non_business_day', reason: 'holiday',
      holidayName: 'Independence Day (observed)'
    });
    expect(getBankingCalendarDay('2027-06-18', 'federal_reserve').status).toBe('business_day');
  });

  it('does not invent a provider schedule for uncovered future dates', () => {
    expect(getBankingCalendarDay('2027-01-04', 'chime')).toMatchObject({
      status: 'unknown', reason: 'source_date_not_covered'
    });
    expect(nextBankingBusinessDay('2026-12-31', 'chime')).toBe(null);
    expect(getBankingCalendarDay('2028-01-03', 'federal_reserve').status).toBe('unknown');
  });

  it('validates dates and keeps next-day estimates advisory rather than payment promises', () => {
    expect(() => getBankingCalendarDay('2026-02-30', 'chime')).toThrow();
    expect(() => getBankingCalendarDay('2026-11-26T12:00:00Z', 'chime')).toThrow();
    expect(() => getBankingCalendarDay('2026-11-26', 'unsupported' as 'chime')).toThrow();
    expect(() => nextBankingBusinessDay('2026-11-26', 'chime', 0)).toThrow();
    const day = getBankingCalendarDay('2026-11-27', 'chime');
    expect(day.status).toBe('business_day');
    expect(day.advisoryOnly).toBe(true);
  });
});
