import { describe, expect, it } from 'vitest';
import { normalizeVoiceCommand, resolveVoiceNavigationCommand } from '../../apps/web/src/modules/voice/voiceActions';

describe('ATLAS Voice safe navigation actions', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizeVoiceCommand('  ¡Muéstrame NÓMINA!  ')).toBe('muestrame nomina');
  });

  it.each([
    ['ATLAS abre nómina', '/payroll'],
    ['Hey ATLAS open finance', '/finance'],
    ['show me health', '/health'],
    ['go to health', '/health'],
    ['ATLAS CRM', '/crm'],
    ['ATLAS muéstrame contabilidad', '/finance/accounting']
  ])('routes %s safely to %s', (transcript, route) => {
    expect(resolveVoiceNavigationCommand(transcript)?.route).toBe(route);
  });

  it('does not treat unscoped conversational text as a navigation command', () => {
    expect(resolveVoiceNavigationCommand('Tell me what payroll means')).toBeNull();
    expect(resolveVoiceNavigationCommand('I am thinking about finance')).toBeNull();
  });

  it('does not create arbitrary routes', () => {
    expect(resolveVoiceNavigationCommand('ATLAS open admin secrets')).toBeNull();
  });
});
