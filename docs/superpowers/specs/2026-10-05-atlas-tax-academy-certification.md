# ATLAS Tax Academy — Practical Training, Examination & Professional Levels

Date: 2026-10-05
Branch: `feat/tax-academy-certification`
Status: Design approved; written specification pending user review

## 1. Objective

ATLAS Tax Academy is a native training and authorization subsystem inside ATLAS Tax. It must prepare tax staff to work from source documents through a complete federal individual tax return, evaluate both knowledge and practical execution, and assign an internal ATLAS professional level based on demonstrated competence.

ATLAS Tax Academy is not an IRS credentialing program. Its internal levels do not replace PTIN, EFIN, Enrolled Agent, CPA, attorney, AFSP, state registration, or any other external legal/professional requirement.

The Academy must reuse the existing ATLAS Tax professional workflow and source-to-line provenance model rather than build a separate tax engine.

## 2. Placement and routes

Primary navigation:

`ATLAS Tax → Academy → Practice & Exams`

Routes:

- `/tax/academy`
- `/tax/academy/practice`
- `/tax/academy/practice/:caseId`
- `/tax/academy/exams`
- `/tax/academy/exams/:examId`
- `/tax/academy/results`
- `/tax/academy/certification`
- `/tax/academy/admin`

ATLAS Tax Academy is additive to the existing professional workspace. It must consume shared tax form catalogs, filing-status logic, rule-pack metadata, diagnostics, evidence-gate concepts, and professional workflow contracts.

## 3. Benchmark: H&R Block training model

The benchmark was reviewed from current public H&R Block sources on 2026-10-05.

Verified public elements:

1. New preparers are directed to H&R Block's Income Tax Course (ITC).
2. Experienced preparers are directed to a Tax Knowledge Assessment (TKA).
3. The current public ITC description includes self-paced/instructor-led learning and hands-on professional tax-preparation exercises.
4. H&R Block publicly describes internal tax-professional levels as:
   - Tax Associate
   - Tax Specialist
   - Senior Tax Specialist
   - Tax Analyst
   - Senior Tax Analyst
   - Master Tax Advisor
5. H&R Block states these levels reflect the level of training an associate has received.
6. Public profiles also show specialist training/certifications such as Small Business, Retirement, Investment Income, and International Taxation.
7. Current H&R Block profiles state tax professionals receive an average of 32+ hours of training per year.
8. H&R Block public career pages distinguish entry via ITC from experienced entry via TKA.

Public benchmark sources:

- https://careers.hrblock.com/who-and-how-we-hire
- https://careers.hrblock.com/tax-opportunities/
- https://www.hrblock.com/corporate/income-tax-course/
- https://www.hrblock.com/tax-pro-details/511600/

Important boundary: H&R Block does not publicly document a current official score-to-title table such as "90% = Tax Analyst." ATLAS must not claim that its score thresholds reproduce H&R Block's internal promotion criteria.

## 4. ATLAS professional level model

ATLAS will use its own transparent, auditable progression. A written exam score alone is insufficient for production authorization. Progression requires knowledge, practical return preparation, evidence discipline, due diligence, and supervised production.

### A0 — Academy Candidate

Purpose: learner with no production authority.

Requirements:
- enrolled in Academy;
- identity and tenant membership verified;
- no unresolved integrity/security violation.

Authority:
- synthetic practice only;
- no client tax conclusion;
- no live-return preparation authorization.

### A1 — Tax Intake Associate

Knowledge target: foundational intake and form recognition.

Requirements:
- module exams: at least 80% each for intake/foundations;
- basic knowledge exam: at least 80%;
- practical intake exercise: at least 90%;
- all critical privacy/security items correct.

Authority:
- collect and classify documents;
- identify missing evidence;
- route W-2/1099/1095-A/1098 and common source documents;
- no independent final tax treatment.

### A2 — Tax Preparer I

Knowledge target: simple individual returns.

Requirements:
- cumulative written score at least 85%;
- simple-return practical at least 90%;
- filing-status practical at least 90%;
- no critical due-diligence failure;
- reviewer approval.

Authority:
- simple W-2/interest/standard-deduction returns;
- basic MFJ/Single/QSS cases within configured scope;
- every live return remains reviewer-gated.

### A3 — Tax Preparer II

Knowledge target: family and credit returns.

Requirements:
- cumulative written score at least 88%;
- HOH/dependent/CTC/EITC/AOTC practicals at least 92%;
- Form 8867 critical items 100%;
- first three supervised live returns accepted by reviewer with no material correction attributable to preparer negligence.

Authority:
- A2 scope plus dependent/family credits and covered due-diligence cases;
- no independent Schedule C/Marketplace/foreign/rental release.

### A4 — Tax Specialist

Knowledge target: self-employment and business-adjacent individual returns.

Requirements:
- cumulative written score at least 90%;
- Schedule C/SE/vehicle/home-office/QBI practical at least 92%;
- evidence-gate score 100% on critical claims;
- at least five supervised production returns in A4 scope signed off by reviewer.

Authority:
- Schedule C;
- Schedule SE;
- vehicle/mileage workpapers;
- home office/Form 8829;
- routine Form 4562 scenarios inside supported rule packs;
- Form 8995/QBI in supported scope;
- reviewer required for filing release.

### A5 — Senior Tax Specialist

Knowledge target: advanced individual returns.

Requirements:
- cumulative written score at least 92%;
- Marketplace, investments, rental, retirement/HSA/IRA basis practicals at least 94%;
- advanced practical average at least 94%;
- no unresolved critical audit finding;
- production-quality reviewer signoff on at least ten A4/A5-scope returns.

Authority:
- A4 scope plus Form 8962, Schedule D/Form 8949, Schedule E, Forms 8606/8889, common amendments, and other explicitly supported advanced forms;
- can perform first-level review of A1–A3 work;
- cannot release production filing unless assigned release permission.

### A6 — Tax Analyst / Reviewer

Knowledge target: integrated return analysis and review.

Requirements:
- final written exam at least 94%;
- capstone practical at least 95%;
- reviewer calibration exercises at least 95%;
- 100% on integrity/security/due-diligence critical items;
- demonstrated ability to identify stale-year rules, source/form mismatches, duplicate deductions, unsupported credits, and dependency recalculation failures.

Authority:
- review A1–A5 returns within supported federal individual scope;
- issue remediation;
- approve internal readiness when all non-tax external filing gates are satisfied;
- no external credential representation implied.

### A7 — Senior Tax Analyst

Knowledge target: complex individual returns and quality governance.

Requirements:
- advanced written/case average at least 96%;
- two independent capstone variants at least 96%;
- review-quality calibration across multiple return classes;
- documented continuing education and annual recertification;
- Tax Director or equivalent internal approval.

Authority:
- second-level review;
- complex federal individual scope including Marketplace, rental, investments, selected international and limitation forms only where ATLAS marks those rule packs as supported;
- mentoring and examiner privileges;
- can approve remediation closure.

### A8 — Master Tax Practitioner

Purpose: highest ATLAS internal individual-tax mastery level.

Requirements:
- score at least 97% on Master written assessment;
- score at least 97% on Master practical battery;
- no critical error across the complete exam battery;
- demonstrated reviewer competency across at least five major domains;
- annual recertification;
- minimum annual continuing education target of 32 hours, unless a stricter federal/state/credential requirement applies;
- final internal approval by Tax Director/Compliance.

Authority:
- senior review and training authority within supported ATLAS Tax individual-return scope;
- may author/approve training cases and golden fixtures under change control;
- may not claim EA/CPA/attorney or IRS representation rights unless that external credential is independently verified.

## 5. Specialty badges

Professional level and specialty are orthogonal.

A candidate may earn verified badges after passing dedicated exams/practicals:

- Family & Credits
- Small Business / Schedule C
- Marketplace / Form 8962
- Retirement & IRA
- Investment Income
- Rental Real Estate
- Depreciation & Basis
- International Individual Tax
- Military Tax
- Multi-State Tax
- Notices & Amendments
- Tax Review & Quality

External credential badges must be evidence-backed and separately labeled:

- EA Verified
- CPA Verified
- Attorney Verified
- AFSP Record of Completion Verified

No external credential badge may be created from Academy scores.

## 6. Exam architecture

### Practice mode

- answers and explanations may be revealed after a checkpoint;
- deterministic calculations use the selected tax-year rule pack;
- practice may generate parameterized synthetic variants;
- results do not alter production authorization.

### Module exams

- 10+ questions per module;
- randomized from a versioned bank;
- pass threshold 80% unless the module-specific level requires more;
- critical questions may require 100%.

### Midterm

- 50 questions;
- pass threshold 85%;
- cross-module coverage.

### Final written

- 100 questions;
- baseline internal certification threshold 90%;
- higher professional levels require higher score bands as defined above;
- answer key never shipped to candidate UI.

### Practical returns

Each candidate receives complete synthetic client facts and source documents and must:

1. determine filing status;
2. identify missing documents;
3. activate the correct forms/schedules;
4. reject nonapplicable forms;
5. map sources to tax facts;
6. calculate the return;
7. clear or document diagnostics;
8. complete due-diligence gates;
9. identify any unsupported or stale-year tax treatment;
10. determine review/e-file readiness.

Practical scoring categories:

- income completeness — 15%;
- filing status/dependents — 10%;
- form routing — 15%;
- calculations/dependencies — 20%;
- credits/Marketplace/due diligence — 15%;
- evidence/substantiation — 10%;
- tax-year law/version control — 5%;
- e-file readiness — 5%;
- security/integrity — 5%.

Critical failures override total score:

- fabricated deduction or evidence;
- knowingly omitted material income;
- unsupported filing status/dependent after contradiction is known;
- intentional stale-year rule use after diagnostic;
- bypassing required Form 8867 due diligence;
- exposure of protected taxpayer data;
- claiming a return was accepted/filed without evidence.

## 7. Dynamic level assignment

ATLAS does not assign a profession level from one percentage alone.

The certification engine evaluates:

- written_score;
- practical_score;
- module mastery;
- critical-item pass state;
- specialty badge results;
- supervised-return count;
- reviewer signoffs;
- remediation history;
- annual recertification status;
- external credential verification separately.

The engine returns:

- current level;
- next eligible level;
- missing requirements;
- permitted return classes;
- required reviewer role;
- specialty badges;
- recertification due date.

A candidate with 98% written knowledge but no practical pass remains below the production-authorized level.

## 8. Annual recertification

Each tax year must be versioned independently.

Before a preparer remains active for a new filing season:

- current-year law-update module completed;
- current-year forms moved from draft/unverified to approved rule pack where applicable;
- annual exam passed;
- critical compliance items 100%;
- required CE status recorded;
- external PTIN/state credential status verified where applicable.

ATLAS must fail closed when recertification expires.

## 9. Data model

New governed tables/services should support:

- `tax_academy_modules`
- `tax_academy_cases`
- `tax_academy_case_versions`
- `tax_academy_questions`
- `tax_academy_exams`
- `tax_academy_attempts`
- `tax_academy_answers`
- `tax_academy_practical_results`
- `tax_academy_specialties`
- `tax_academy_user_specialties`
- `tax_academy_professional_levels`
- `tax_academy_user_level_history`
- `tax_academy_supervised_returns`
- `tax_academy_reviewer_signoffs`
- `tax_academy_recertifications`

All tenant-owned rows require RLS and tenant identity constraints.

Instructor answer keys and grading rules must not be readable through candidate endpoints.

## 10. Domain package

Create `packages/tax-academy` as the deterministic domain layer.

Responsibilities:

- training/case contracts;
- professional-level policy;
- scoring;
- critical-failure evaluation;
- specialty badge rules;
- case versioning;
- rule-pack compatibility;
- form activation expectations;
- synthetic case generators;
- certification eligibility.

UI must not contain authoritative scoring logic.

## 11. UI

Create `apps/web/src/modules/tax/academy`.

Surfaces:

- AcademyDashboard
- PracticeLibrary
- PracticalReturnRunner
- ExamLibrary
- ExamRunner
- ResultsDashboard
- CertificationProfile
- SpecialtyBadges
- InstructorReviewQueue
- AcademyAdmin

The existing `TaxRoutes.tsx` receives Academy navigation without replacing the canonical Tax workspace.

## 12. Integration with existing ATLAS Tax architecture

Academy must reuse:

- existing `TAX_FORM_CATALOG` where compatible;
- professional return workflow;
- tax-year rule-pack metadata;
- form/source mapping contracts;
- diagnostics concepts;
- identity/tenant controls;
- audit/evidence conventions.

Training cases must be able to graduate into golden test fixtures for production calculators, but only through explicit review and version-control approval.

## 13. 2026 draft-form boundary

As of 2026-10-05, the IRS still publishes multiple 2026 forms as drafts. Academy may label content as `training-current` when based on enacted/current guidance, but it must not label a form implementation `production-certified` until the final official form/instructions and ATLAS rule pack have been reviewed.

Required states:

- `training_current`
- `draft_form_review_required`
- `final_form_verified`
- `production_certified`
- `retired`

No draft-form state may silently activate production filing readiness.

## 14. Audit and security

Every exam/certification decision records:

- tenant;
- user;
- exam/case version;
- tax-year rule-pack version;
- score;
- critical failures;
- reviewer;
- timestamp;
- level before/after;
- reason/evidence.

Candidate exam data must not expose taxpayer production data. Practice cases use synthetic or explicitly de-identified fixtures only.

## 15. Testing requirements

TDD is mandatory.

At minimum:

1. level-policy tests;
2. score-boundary tests;
3. critical-failure override tests;
4. candidate/instructor answer-key isolation tests;
5. tenant/RLS tests;
6. tax-year version mismatch tests;
7. form-routing tests;
8. supervised-return requirement tests;
9. recertification expiry tests;
10. specialty badge tests;
11. UI route/access tests;
12. Golden Case regression tests.

## 16. Success criteria

The subsystem is complete only when evidence proves:

- Academy routes render inside ATLAS Tax;
- practice and exam modes are isolated;
- 300-question bank and complete practical cases are versioned;
- professional level assignment is deterministic and tested;
- no candidate endpoint exposes answer keys;
- RLS prevents cross-tenant access;
- critical failures override numeric score;
- annual recertification gates production authority;
- Golden Case is available only in de-identified form;
- 2026 draft-form content is clearly non-production-certified;
- CI passes;
- production deployment is verified E2E before claiming release.
