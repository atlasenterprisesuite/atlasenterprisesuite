import type { AcademyRulePackStatus, RecertificationDecision, RecertificationEvidence } from './types';

export function canUseAcademyRulePackForProduction(status: AcademyRulePackStatus): boolean {
  return status === 'production_certified';
}

function dateExpired(asOfDate?: string, dueDate?: string) {
  if (!asOfDate || !dueDate) return false;
  const asOf = Date.parse(asOfDate);
  const due = Date.parse(dueDate);
  if (!Number.isFinite(asOf) || !Number.isFinite(due)) return true;
  return asOf > due;
}

export function evaluateRecertification(input: RecertificationEvidence): RecertificationDecision {
  const missingRequirements: string[] = [];
  const lawUpdatePassed = input.lawUpdateCompleted ?? input.currentYearLawModulePassed ?? false;

  if (!lawUpdatePassed) missingRequirements.push('current-year law update module');
  if (input.annualExamScore !== undefined && input.annualExamScore < 90) missingRequirements.push('annual exam >= 90%');
  if (!input.criticalCompliancePassed) missingRequirements.push('critical compliance');
  if (input.ceHours < input.requiredCeHours) missingRequirements.push('continuing education');
  if (input.ptinRequired && !input.ptinVerified) missingRequirements.push('PTIN verification');
  if (input.stateCredentialRequired && !input.stateCredentialVerified) missingRequirements.push('state credential verification');
  if (input.externalRequirementsVerified === false) missingRequirements.push('external requirements');
  if (dateExpired(input.asOfDate, input.dueDate)) missingRequirements.push('annual recertification expired');

  const current = missingRequirements.length === 0;
  if (!canUseAcademyRulePackForProduction(input.rulePackStatus)) {
    missingRequirements.push('production-certified tax-year rule pack');
  }
  const productionAuthorized = current && canUseAcademyRulePackForProduction(input.rulePackStatus);

  return {
    taxYear: input.taxYear,
    current,
    productionAuthorized,
    activeForProduction: productionAuthorized,
    missingRequirements,
    nextDueDate: input.dueDate ?? null,
  };
}
