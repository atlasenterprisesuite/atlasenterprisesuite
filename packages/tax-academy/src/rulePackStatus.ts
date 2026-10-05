import type { AcademyRulePackStatus, RecertificationDecision, RecertificationEvidence } from './types';

export function canUseAcademyRulePackForProduction(status: AcademyRulePackStatus): boolean {
  return status === 'production_certified';
}

export function evaluateRecertification(input: RecertificationEvidence): RecertificationDecision {
  const missingRequirements: string[] = [];
  if (!input.currentYearLawModulePassed) missingRequirements.push('current_year_law_module');
  if (input.annualExamScore < 90) missingRequirements.push('annual_exam_90');
  if (!input.criticalCompliancePassed) missingRequirements.push('critical_compliance');
  if (input.ceHours < input.requiredCeHours) missingRequirements.push('continuing_education');
  if (!input.externalRequirementsVerified) missingRequirements.push('external_requirements');
  if (!canUseAcademyRulePackForProduction(input.rulePackStatus)) missingRequirements.push('production_certified_rule_pack');

  return {
    taxYear: input.taxYear,
    activeForProduction: missingRequirements.length === 0,
    missingRequirements
  };
}
