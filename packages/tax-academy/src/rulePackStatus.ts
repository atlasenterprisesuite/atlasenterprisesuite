import type { AcademyRulePackStatus } from './types';
export function canUseAcademyRulePackForProduction(status: AcademyRulePackStatus): boolean {
  return status === 'production_certified';
}
