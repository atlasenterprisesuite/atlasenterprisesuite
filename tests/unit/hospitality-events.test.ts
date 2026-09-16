import { describe, expect, it } from 'vitest';
import { classifyEventChange, transitionHospitalityEvent } from '../../packages/hospitality/events';

describe('Hospitality Events / BEO core', () => {
  it('supports the canonical event lifecycle', () => {
    expect(transitionHospitalityEvent('inquiry', 'tentative')).toBe('tentative');
    expect(transitionHospitalityEvent('tentative', 'confirmed')).toBe('confirmed');
    expect(transitionHospitalityEvent('confirmed', 'planning')).toBe('planning');
    expect(transitionHospitalityEvent('planning', 'ready')).toBe('ready');
    expect(transitionHospitalityEvent('ready', 'in_progress')).toBe('in_progress');
    expect(transitionHospitalityEvent('in_progress', 'completed')).toBe('completed');
    expect(transitionHospitalityEvent('completed', 'closed')).toBe('closed');
  });

  it('rejects closing an event directly from inquiry', () => {
    expect(() => transitionHospitalityEvent('inquiry', 'closed')).toThrow('invalid_event_transition');
  });

  it('classifies guest-count and timing changes as multi-department impacts', () => {
    expect(classifyEventChange({ type: 'guest_count', after: 165, before: 120 })).toEqual({
      level: 'high',
      affectedDomains: ['banquets', 'culinary', 'staffing', 'inventory', 'billing']
    });
    expect(classifyEventChange({ type: 'event_time', before: '18:00', after: '20:00' }).level).toBe('high');
  });

  it('keeps unrecognized changes reviewable instead of silently ignoring them', () => {
    expect(classifyEventChange({ type: 'custom_requirement', before: null, after: 'new' }))
      .toEqual({ level: 'review', affectedDomains: [] });
  });
});
