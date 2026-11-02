export type RegulatoryApplicability = 'required' | 'conditional' | 'not_applicable' | 'unknown';
export type RegulatoryFilingStatus = 'not_started' | 'draft' | 'ready_for_review' | 'authorized' | 'submitted' | 'accepted' | 'rejected';
export type RegulatoryEntity = {
  tenantId: string;
  organizationId: string;
  jurisdiction: 'US-FL' | string;
  legalForm: 'LLC' | 'corporation' | 'other';
  owners: number;
  employees: number;
  federalTaxTreatment: 'default_disregarded' | 'partnership' | 'c_corporation' | 's_corporation' | 'unknown';
  floridaReemploymentAccountActive: boolean | null;
  floridaSalesTaxRegistrationActive: boolean | null;
};
export type RegulatoryObligation = {
  code: string;
  agency: string;
  formCode: string | null;
  applicability: RegulatoryApplicability;
  reason: string;
  sourceUrl: string;
  ruleVersion: string;
};
const RULE_VERSION = '2026-10-22-initial-review';
function obligation(code: string, agency: string, formCode: string | null, applicability: RegulatoryApplicability, reason: string, sourceUrl: string): RegulatoryObligation {
  return { code, agency, formCode, applicability, reason, sourceUrl, ruleVersion: RULE_VERSION };
}
/** Conservative assessment: unknown registration or tax classification never implies exemption. */
export function assessFloridaSoftwareLLC(entity: RegulatoryEntity): RegulatoryObligation[] {
  if (!entity.tenantId || !entity.organizationId || entity.jurisdiction !== 'US-FL' || entity.legalForm !== 'LLC' || !Number.isInteger(entity.employees) || entity.employees < 0 || !Number.isInteger(entity.owners) || entity.owners < 1) {
    throw new Error('invalid_regulatory_entity');
  }
  const hasEmployees = entity.employees > 0;
  return [
    obligation('FL_ANNUAL_REPORT', 'Florida Division of Corporations', 'Annual Report', 'required', 'Florida LLC annual report; first due year depends on effective formation date.', 'https://dos.fl.gov/sunbiz/manage-business/efile/annual-report/'),
    obligation('FEDERAL_INCOME_TAX', 'IRS', null, entity.federalTaxTreatment === 'unknown' ? 'unknown' : 'required', 'Return and taxpayer depend on federal tax election and taxable activity.', 'https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc'),
    obligation('FL_REEMPLOYMENT_RT6', 'Florida Department of Revenue', 'RT-6', entity.floridaReemploymentAccountActive === true ? 'required' : entity.floridaReemploymentAccountActive === null ? 'unknown' : hasEmployees ? 'conditional' : 'not_applicable', 'Active liable accounts may require zero-wage returns; verify account status.', 'https://floridarevenue.com/taxes/taxesfees/Pages/reemployment.aspx'),
    obligation('FL_SALES_TAX', 'Florida Department of Revenue', 'DR-15', entity.floridaSalesTaxRegistrationActive === true ? 'required' : 'conditional', 'Taxability and filing cadence depend on transactions and account status.', 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx'),
    obligation('FEDERAL_PAYROLL', 'IRS', '941/940', hasEmployees ? 'conditional' : 'not_applicable', 'Evaluate actual wages, payroll tax liability and existing filing obligations.', 'https://www.irs.gov/businesses/small-businesses-self-employed/employment-taxes'),
    obligation('FL_NEW_HIRE', 'Florida New Hire Reporting Center', null, hasEmployees ? 'conditional' : 'not_applicable', 'Triggered by reportable new hires or qualifying contractors.', 'https://fl-newhire.com/'),
    obligation('LOCAL_BUSINESS_TAX', 'Local government', null, 'unknown', 'Verify city, county, location and local exemptions.', 'https://floridarevenue.com/taxes/taxesfees/Pages/local_option.aspx')
  ];
}
/** Submission must never be inferred from a draft or user assertion. */
export function canMarkRegulatoryFilingAccepted(status: RegulatoryFilingStatus, agencyReceipt: string | null): boolean {
  return status === 'submitted' && typeof agencyReceipt === 'string' && agencyReceipt.trim().length > 0;
}
