import { useState } from 'react';
import {
  BANKING_CALENDAR_SOURCES,
  getBankingCalendarDay,
  nextBankingBusinessDay,
  type BankingCalendarSource
} from '../../../../packages/core/src/bankingCalendar';

function todayInNewYork(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Informational reference only: not a banking connection or payment scheduler. */
export function BankingCalendarPanel() {
  const [date, setDate] = useState(todayInNewYork);
  const [source, setSource] = useState<BankingCalendarSource>('federal_reserve');
  const day = getBankingCalendarDay(date, source);
  const next = day.status === 'non_business_day' ? nextBankingBusinessDay(date, source) : null;

  return (
    <section className="execution-panel" aria-labelledby="atlas-banking-calendar-title">
      <div className="work-section-heading">
        <div>
          <p className="eyebrow">ATLAS Finance / Payroll · Reference only</p>
          <h2 id="atlas-banking-calendar-title">U.S. banking calendar</h2>
          <p>Compare published holiday schedules before planning payroll or receivables. No bank account is connected.</p>
        </div>
      </div>
      <div className="work-preview-facts">
        <div>
          <label htmlFor="atlas-banking-source">Calendar source</label>
          <select id="atlas-banking-source" value={source} onChange={event => setSource(event.target.value as BankingCalendarSource)}>
            <option value="federal_reserve">Federal Reserve Financial Services</option>
            <option value="chime">Chime published 2026 schedule</option>
          </select>
        </div>
        <div>
          <label htmlFor="atlas-banking-date">Calendar date</label>
          <input id="atlas-banking-date" type="date" value={date} min="2026-01-01" max="2027-12-31"
            onChange={event => { if (event.target.value) setDate(event.target.value); }} />
        </div>
      </div>
      <p role="status">
        <strong>{day.status === 'business_day' ? 'Scheduled business day' : day.status === 'non_business_day' ? 'Non-business day' : 'Source schedule unavailable'}</strong>
        {day.holidayName ? ` · ${day.holidayName}` : day.reason === 'weekend' ? ' · Weekend' : null}
        {next ? ` · Next listed business day: ${next}` : null}
      </p>
      <p>
        Dates are advisory only. Actual ACH/payroll submission cutoffs, funds availability and any early deposit
        depend on the relevant bank, employer, payment rail and provider. Do not use this calendar to trigger transfers.
      </p>
      <p>
        Source: <a href={BANKING_CALENDAR_SOURCES[source]} target="_blank" rel="noopener noreferrer">
          {source === 'chime' ? 'Chime 2026 holiday schedule' : 'Federal Reserve holiday schedules'}
        </a>.
      </p>
    </section>
  );
}
