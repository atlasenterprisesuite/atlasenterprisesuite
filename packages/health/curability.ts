import type { CurabilityLevel } from './types';

export const curabilityDefinitions: Record<CurabilityLevel, string> = {
  C0: 'No established disease-modifying therapy.',
  C1: 'Symptom control is established.',
  C2: 'Disease progression can be modified.',
  C3: 'Remission is possible in defined contexts.',
  C4: 'Durable treatment-free remission is documented in selected patients.',
  C5: 'Reproducible individual cure is documented for a defined disease or subtype.',
  C6: 'Population-level elimination is achievable.',
  C7: 'Global eradication is achieved.'
};
