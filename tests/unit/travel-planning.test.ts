import { describe, expect, it } from 'vitest';
import {
  travelSearchUrl, tripCalendarIcs, tripNights, validateTripPlan,
  type TripPlan
} from '../../apps/web/src/modules/travel/travelPlanning';

const plan: TripPlan = {
  destination: 'Orlando, Florida',
  checkIn: '2026-11-10',
  checkOut: '2026-11-13',
  travelers: 2,
  budget: 400,
  services: [{ id: 'room1', category: 'hotel', title: 'Habitación a comparar', notes: 'Precio sujeto a confirmar', estimatedCost: 280 }]
};

describe('ATLAS Travel planning (no external booking)', () => {
  it('counts hotel nights and rejects impossible dates', () => {
    expect(tripNights(plan)).toBe(3);
    expect(validateTripPlan(plan)).toBeNull();
    expect(validateTripPlan({ ...plan, checkOut: '2026-11-10' })).toMatch(/fechas/);
    expect(validateTripPlan({ ...plan, checkIn: '2026-02-30' })).toMatch(/fechas/);
    expect(validateTripPlan({ ...plan, travelers: 0 })).toMatch(/viajeros/);
  });

  it('builds a normal external web search, not an invented booking link', () => {
    const url = new URL(travelSearchUrl(plan, 'car'));
    expect(url.origin).toBe('https://www.google.com');
    expect(url.searchParams.get('q')).toContain('alquiler de autos');
    expect(url.searchParams.get('q')).toContain('2026-11-13');
    expect(() => travelSearchUrl(plan, 'unsupported' as 'car')).toThrow('Categoría');
  });

  it('exports a clearly tentative all-day calendar event without falsely confirming a booking', () => {
    const content = tripCalendarIcs({ ...plan, destination: 'Orlando, FL;\nResumen' }, new Date('2026-10-09T12:00:00Z'));
    expect(content).toContain('DTSTART;VALUE=DATE:20261110');
    expect(content).toContain('DTEND;VALUE=DATE:20261113');
    expect(content).toContain('STATUS:TENTATIVE');
    expect(content).toContain('TRANSP:TRANSPARENT');
    expect(content).toContain('No existe reserva');
    expect(content).toContain('Orlando\\, FL\\;\\nResumen');
    expect(content).not.toContain('\nResumen\r\n');
  });

  it('rejects fake costs and excessive option counts', () => {
    expect(validateTripPlan({ ...plan, services: [{ ...plan.services[0], estimatedCost: -2 }] })).toMatch(/costo/);
    expect(validateTripPlan({ ...plan, services: Array.from({ length: 101 }, (_, id) => ({ ...plan.services[0], id: String(id) })) })).toMatch(/Máximo/);
  });
});
