import type { AcademyCaseDefinition, AcademyFilingStatus, ProfessionalLevelId } from '../types';

const statuses: readonly AcademyFilingStatus[]=['single','mfj','mfs','hoh','qss'];
const levels: readonly ProfessionalLevelId[]=['A1','A2','A3','A4','A5','A6'];

const themes = [
  'W-2 and interest intake','Senior retirement income','Head of household due diligence','Dependent care',
  'Joint wage return','Separate spouse return','Surviving spouse','Itemized deduction decision',
  'Marketplace reconciliation','Marketplace excess APTC','Schedule C mileage','Home office',
  'Depreciation and basis','QBI','Education credit','HSA','IRA basis','Capital gains',
  'Rental real estate','Foreign tax credit','Foreign earned income review','Estimated tax',
  'Energy-credit carryforward review','Gambling limitations','Qualified tips','Qualified overtime',
  'Vehicle-loan interest','Household employee','Adoption credit','Integrated Golden Case'
] as const;

export const ACADEMY_2026_CASES: readonly AcademyCaseDefinition[] = themes.map((title,index) => {
  const filingStatus=statuses[index % statuses.length];
  const business=index===10 || index===11 || index===12 || index===13 || index===29;
  const marketplace=index===8 || index===9 || index===29;
  const requiredForms=[{formId:'1040'}];
  if (business) requiredForms.push({formId:'schedule-c'},{formId:'schedule-se'});
  if (marketplace) requiredForms.push({formId:'8962'});
  const conditionalForms = index===11 ? [{formId:'8829',reviewOnly:true,catalogGap:'Form 8829 is not yet a first-class TAX_FORM_CATALOG entry.'}] : [];
  return {
    id:'2026-P'+String(index+1).padStart(2,'0'),
    version:'2026.1',
    taxYear:2026,
    filingStatus,
    level:levels[Math.min(levels.length-1,Math.floor(index/5))],
    title,
    facts:['Synthetic taxpayer facts for '+title,'Amounts are generated per attempt from bounded training parameters.'],
    sourceDocuments: business ? ['Synthetic W-2','Synthetic 1099-NEC','Synthetic mileage log'] : ['Synthetic W-2','Synthetic supporting statement'],
    requiredForms,
    conditionalForms,
    evidenceGates:['identity/status evidence','income completeness','current-year rule pack'],
    tasks:['determine filing status','route source documents','select forms','compute return','clear evidence gates'],
    criticalTraps:['do not fabricate evidence','do not omit material income','do not use stale-year rules after diagnostic'],
    answerKeyRef:'instructor://tax-academy/2026/P'+String(index+1).padStart(2,'0'),
    rulePackStatus:'training_current',
    deidentified:true,
    goldenDerived:index===29,
    practiceVariants:10,
  } satisfies AcademyCaseDefinition;
});

export function getAcademyCase(caseId: string): AcademyCaseDefinition | undefined {
  return ACADEMY_2026_CASES.find(c=>c.id===caseId);
}

export function expandedPracticeExerciseCount(cases: readonly AcademyCaseDefinition[]): number {
  return cases.reduce((sum,c)=>sum+c.practiceVariants,0);
}
