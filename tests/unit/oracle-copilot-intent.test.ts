import { describe, expect, it } from 'vitest';
import { detectOracleIntent } from '../../supabase/functions/atlas-copilot/oracle-intent.mjs';

describe('ATLAS Copilot Oracle intent detection', () => {
  it.each([
    ['Dame mi lectura de cartas de hoy', 'daily'],
    ['Léeme con mis cartas místicas', 'daily'],
    ["Give me today's oracle reading", 'daily'],
    ['Hazme una lectura de amor con el oráculo', 'love'],
    ['Quiero una lectura de dinero', 'money'],
    ['Lectura de trabajo', 'work'],
    ['Quiero una reflexión emocional con mis cartas', 'emotional'],
    ['Dame un mensaje espiritual con el oráculo', 'spiritual'],
    ['Hazme la lectura completa de las cartas místicas', 'full']
  ])('routes %s as %s', (message, readingType) => {
    expect(detectOracleIntent(message)).toEqual({ readingType });
  });

  it('does not capture unrelated enterprise prompts', () => {
    expect(detectOracleIntent('Explain our accounting close status')).toBeNull();
  });
});
