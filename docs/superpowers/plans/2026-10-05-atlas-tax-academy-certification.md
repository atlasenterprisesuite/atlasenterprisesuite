# ATLAS Tax Academy Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Tax Academy as a native, governed training/examination subsystem that uses the existing ATLAS Tax form/workflow architecture, delivers versioned practice and practical returns, scores exams deterministically, and assigns auditable A0–A8 professional levels without implying external IRS credentials.

**Architecture:** Add a deterministic `packages/tax-academy` domain package for case contracts, scoring, critical failures, specialties, professional-level policy and tax-year training status. Persist user attempts, practical results, reviewer signoffs, level history and recertification in Supabase under tenant RLS; keep instructor keys out of candidate endpoints. Add Academy UI under the existing Tax shell and reuse `TAX_FORM_CATALOG`, ATLAS Identity, the professional return workflow, source/evidence concepts and fail-closed production semantics.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router, Vite 6.4, Vitest 5, Supabase/Postgres RLS/RPC, existing `apps/web/src/lib/atlasSession.ts`, existing `apps/web/src/lib/taxApi.ts`, existing `packages/tax-forms/src`.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-tax-academy-certification.md`

## Global Constraints

- Academy levels A0–A8 are internal ATLAS authorization levels only; they must never be presented as PTIN, EFIN, EA, CPA, attorney, AFSP or other external credentials.
- H&R Block is a benchmark only; do not claim ATLAS score thresholds reproduce H&R Block internal promotion criteria.
- Candidate users must never receive instructor answer keys, grading rules that reveal answers, or hidden expected values through UI/API payloads.
- Critical failures override numerical scores: fabricated deduction/evidence, knowingly omitted material income, unsupported filing status/dependent after contradiction, intentional stale-year rule use after diagnostic, Form 8867 bypass, protected-taxpayer-data exposure, or claiming filed/accepted status without evidence.
- Written score alone cannot authorize production; professional levels require practical results, critical-item state, supervised-return counts and reviewer signoff as defined in the spec.
- 2026 Academy material remains `training_current` while relevant IRS forms/rules are draft/unverified; it cannot become `production_certified` until final-form/rule-pack verification is recorded.
- Production filing remains governed by the existing ATLAS Tax filing boundary; Academy may never bypass identity, provider/EFIN, diagnostics, review, signature, rule-pack or transmission gates.
- All tenant-owned Academy persistence must enforce RLS and tenant identity constraints; browser writes are RPC-mediated where privileged validation is required.
- External credential badges are evidence-backed and separate from Academy scores.
- Practice/case data is synthetic or de-identified; no real taxpayer SSNs, full TINs, bank data, signatures or secret references belong in training content.

## Review Focus

1. **Candidate answer-key leakage:** a candidate loading practice/exam routes or network payloads must not receive answer keys or hidden grading values. Task 6 adds browser/source contract tests and Task 4 adds candidate-safe RPC/API tests.
2. **Score-only overpromotion:** a 98% written result with no practical/reviewer evidence must remain below the production-authorized level. Task 1 pins this in policy tests.
3. **Critical failure masked by average:** a passing average with one integrity/security critical failure must fail the practical/certification decision. Task 1 and Task 7 test this explicitly.
4. **Stale/draft tax-year content:** 2026 `training_current` cases must not be surfaced as production-certified or used to grant production readiness. Task 2 and Task 7 add rule-pack status tests.
5. **Cross-tenant/instructor privilege leakage:** candidate or other-tenant users must not read instructor keys, reviewer notes or another tenant's attempts/certification. Task 3 adds RLS/schema contract tests and Task 8 tests instructor-only UI/API gates.

---

## File Structure

### Domain package
- Create `packages/tax-academy/src/types.ts` — shared Academy contracts and enums.
- Create `packages/tax-academy/src/professionalLevels.ts` — A0–A8 policy and permission decisions.
- Create `packages/tax-academy/src/scoring.ts` — written/practical scoring and critical-failure handling.
- Create `packages/tax-academy/src/specialties.ts` — specialty badge rules and external-credential separation.
- Create `packages/tax-academy/src/rulePackStatus.ts` — `training_current` / `final_form_verified` / `production_certified` gating.
- Create `packages/tax-academy/src/cases/2026.ts` — versioned synthetic case/practical catalog metadata.
- Create `packages/tax-academy/src/index.ts` — public domain exports.

### Persistence
- Create `supabase/migrations/20261005xxxxxx_tax_academy_certification.sql` — Academy attempt/result/certification tables, RLS, grants and RPCs.

### Web API
- Create `apps/web/src/lib/taxAcademyApi.ts` — tenant-aware candidate/instructor Academy API.

### UI
- Create `apps/web/src/modules/tax/academy/AcademyDashboard.tsx`.
- Create `apps/web/src/modules/tax/academy/PracticeLibrary.tsx`.
- Create `apps/web/src/modules/tax/academy/PracticalReturnRunner.tsx`.
- Create `apps/web/src/modules/tax/academy/ExamLibrary.tsx`.
- Create `apps/web/src/modules/tax/academy/ExamRunner.tsx`.
- Create `apps/web/src/modules/tax/academy/ResultsDashboard.tsx`.
- Create `apps/web/src/modules/tax/academy/CertificationProfile.tsx`.
- Create `apps/web/src/modules/tax/academy/InstructorReviewQueue.tsx`.
- Create `apps/web/src/modules/tax/academy/AcademyAdmin.tsx`.
- Create `apps/web/src/modules/tax/academy/academy.css`.
- Modify `apps/web/src/modules/tax/TaxRoutes.tsx` — Academy nav/routes.
- Modify `apps/web/src/modules/tax/TaxProfessionalDashboard.tsx` — Academy entry card/progress surface.

### Tests
- Create `tests/unit/tax-academy-domain.test.ts`.
- Create `tests/unit/tax-academy-content.test.ts`.
- Create `tests/integration/tax-academy-schema.test.ts`.
- Create `tests/integration/tax-academy-api.test.ts`.
- Create `tests/integration/tax-academy-ui.test.ts`.
- Create `tests/integration/tax-academy-security.test.ts`.

---

### Task 1: Deterministic scoring and A0–A8 professional-level policy

**Files:**
- Create: `packages/tax-academy/src/types.ts`
- Create: `packages/tax-academy/src/scoring.ts`
- Create: `packages/tax-academy/src/professionalLevels.ts`
- Create: `packages/tax-academy/src/specialties.ts`
- Create: `packages/tax-academy/src/index.ts`
- Test: `tests/unit/tax-academy-domain.test.ts`

**Interfaces:**
- Produces: `ProfessionalLevelId = 'A0'|'A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'A7'|'A8'`.
- Produces: `CriticalFailureCode` containing the seven critical-failure categories from Global Constraints.
- Produces: `scoreWrittenExam(submission: WrittenExamSubmission, blueprint: WrittenExamBlueprint): WrittenExamScore`.
- Produces: `scorePracticalReturn(input: PracticalScoreInput): PracticalScore`.
- Produces: `evaluateProfessionalLevel(evidence: CertificationEvidence): ProfessionalLevelDecision`.
- Produces: `evaluateSpecialtyBadges(evidence: SpecialtyEvidence): SpecialtyDecision[]`.

- [ ] **Step 1: Write failing domain tests for score calculation and critical-failure override**

In `tests/unit/tax-academy-domain.test.ts`, assert:
- 90 correct of 100 noncritical written questions yields `90`.
- one failed critical practical item returns `passed: false` even when weighted score is `97`.
- instructor/external credential flags do not affect numeric written score.

- [ ] **Step 2: Run the domain test to verify RED**

Run: `npx vitest run tests/unit/tax-academy-domain.test.ts`
Expected: FAIL because `packages/tax-academy/src` exports do not exist.

- [ ] **Step 3: Implement the scoring contracts and minimal scoring functions**

Implement exact public signatures listed in Interfaces. `PracticalScore` must include `weightedScore`, `criticalFailures`, `passed`; critical failures always force `passed=false`.

- [ ] **Step 4: Add failing professional-level policy tests**

Assert:
- written 98%, no practical pass/reviewer signoff => cannot reach A4+.
- A2 requires cumulative written `>=85`, simple-return practical `>=90`, filing-status practical `>=90`, no critical failure, reviewer approval.
- A4 requires cumulative written `>=90`, business practical `>=92`, critical evidence gates clean, at least five supervised A4-scope returns.
- A6 requires written `>=94`, capstone `>=95`, reviewer calibration `>=95`, all critical items passed.
- A8 requires written/practical `>=97`, no critical error, five domain competencies, annual recertification, `>=32` CE hours and final internal approval.

- [ ] **Step 5: Run policy tests and verify RED**

Run: `npx vitest run tests/unit/tax-academy-domain.test.ts`
Expected: FAIL on unimplemented level policy assertions.

- [ ] **Step 6: Implement `evaluateProfessionalLevel` and permitted-scope outputs**

`ProfessionalLevelDecision` must return `currentLevel`, `nextEligibleLevel`, `missingRequirements`, `permittedReturnClasses`, `reviewerRequired` and `productionAuthorized`.

- [ ] **Step 7: Add and pass specialty/external-credential separation tests**

Assert Academy scores can grant internal specialty badges but cannot create `EA Verified`, `CPA Verified`, `Attorney Verified` or `AFSP Record of Completion Verified` without separate `externalCredentialVerified=true` evidence.

Run: `npx vitest run tests/unit/tax-academy-domain.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/tax-academy/src tests/unit/tax-academy-domain.test.ts
git commit -m "feat(tax): add academy scoring and professional levels"
```

### Task 2: Versioned 2026 Academy case catalog and tax-year rule-pack status

**Files:**
- Create: `packages/tax-academy/src/rulePackStatus.ts`
- Create: `packages/tax-academy/src/cases/2026.ts`
- Test: `tests/unit/tax-academy-content.test.ts`
- Consume: `packages/tax-forms/src/index.ts` `TAX_FORM_CATALOG`

**Interfaces:**
- Consumes: `TAX_FORM_CATALOG` from `packages/tax-forms/src`.
- Produces: `AcademyRulePackStatus = 'training_current'|'final_form_verified'|'production_certified'`.
- Produces: `ACADEMY_2026_CASES: readonly AcademyCaseDefinition[]`.
- Produces: `getAcademyCase(caseId: string): AcademyCaseDefinition | undefined`.
- Produces: `canUseAcademyRulePackForProduction(status: AcademyRulePackStatus): boolean`.

- [ ] **Step 1: Write failing content contract tests**

Assert:
- catalog contains at least 300 practice exercises and at least 30 complete practical-return cases or parameterized case definitions capable of generating that inventory;
- all five filing statuses are represented: Single, MFJ, MFS, HOH, QSS;
- Golden Case-derived content is marked `deidentified: true`;
- no training fact contains patterns matching full SSNs or bank account numbers;
- all referenced forms either map to existing `TAX_FORM_CATALOG` ids or are explicitly `review_only` with a documented catalog gap.

- [ ] **Step 2: Run content tests to verify RED**

Run: `npx vitest run tests/unit/tax-academy-content.test.ts`
Expected: FAIL because 2026 catalog/rule status do not exist.

- [ ] **Step 3: Implement 2026 catalog metadata and generator-safe synthetic cases**

Case definitions must include: `id`, `version`, `taxYear`, `filingStatus`, `level`, `title`, `facts`, `sourceDocuments`, `requiredForms`, `conditionalForms`, `evidenceGates`, `tasks`, `criticalTraps`, `answerKeyRef`, `rulePackStatus`, `deidentified`.

- [ ] **Step 4: Add failing stale-year production-gate tests**

Assert `training_current` and `final_form_verified` return `false` from `canUseAcademyRulePackForProduction`; only `production_certified` returns `true`.

- [ ] **Step 5: Implement rule-pack status gate and pass all content tests**

Run: `npx vitest run tests/unit/tax-academy-content.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tax-academy/src/rulePackStatus.ts packages/tax-academy/src/cases/2026.ts tests/unit/tax-academy-content.test.ts
git commit -m "feat(tax): add versioned academy case catalog"
```

### Task 3: Supabase persistence, RLS and candidate/instructor separation

**Files:**
- Create: `supabase/migrations/20261005xxxxxx_tax_academy_certification.sql`
- Test: `tests/integration/tax-academy-schema.test.ts`

**Interfaces:**
- Produces tables: `tax_academy_attempts`, `tax_academy_answers`, `tax_academy_practical_results`, `tax_academy_user_specialties`, `tax_academy_user_level_history`, `tax_academy_supervised_returns`, `tax_academy_reviewer_signoffs`, `tax_academy_recertifications`.
- Produces RPCs: `tax_academy_start_attempt`, `tax_academy_submit_answer`, `tax_academy_complete_attempt`, `tax_academy_record_reviewer_signoff`, `tax_academy_get_candidate_summary`.
- Candidate summary RPC must never return answer keys or instructor-only notes.

- [ ] **Step 1: Write failing schema/RLS contract tests**

Following `tests/integration/tax-client-intake-schema.test.ts`, assert SQL contains:
- `enable row level security` for every tenant-owned Academy table;
- `org_id` tenant column on attempts/results/history/signoffs;
- read policies restricted to current organization/user role;
- no browser direct write grants to certification level history or reviewer signoffs;
- candidate summary RPC explicitly excludes instructor answer-key columns/data.

- [ ] **Step 2: Run schema test to verify RED**

Run: `npx vitest run tests/integration/tax-academy-schema.test.ts`
Expected: FAIL because migration is absent.

- [ ] **Step 3: Implement tables, indexes, RLS, grants and validation RPCs**

Use existing ATLAS org/identity helpers and least-privilege patterns. Store only case/question ids + version hashes/references in user attempts; do not duplicate hidden answer text into candidate-readable rows.

- [ ] **Step 4: Add cross-tenant/instructor privilege assertions**

Assert SQL policies prevent one org reading another org's attempts and prevent ordinary candidate roles from selecting reviewer signoff notes or instructor-only grading data.

- [ ] **Step 5: Run schema test to verify GREEN**

Run: `npx vitest run tests/integration/tax-academy-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261005xxxxxx_tax_academy_certification.sql tests/integration/tax-academy-schema.test.ts
git commit -m "feat(tax): persist academy progress with tenant RLS"
```

### Task 4: Tenant-aware Academy browser API

**Files:**
- Create: `apps/web/src/lib/taxAcademyApi.ts`
- Test: `tests/integration/tax-academy-api.test.ts`

**Interfaces:**
- Consumes: `authorizedAtlasFetch`, `getActiveAtlasOrganization` from `apps/web/src/lib/atlasSession.ts`.
- Produces: `startAcademyAttempt(input: StartAttemptInput): Promise<AcademyAttemptRow>`.
- Produces: `submitAcademyAnswer(input: SubmitAnswerInput): Promise<AcademyAnswerReceipt>`.
- Produces: `completeAcademyAttempt(attemptId: string): Promise<AcademyAttemptResult>`.
- Produces: `getAcademyCandidateSummary(): Promise<AcademyCandidateSummary>`.
- Produces instructor-only: `listAcademyReviewQueue()` and `recordAcademyReviewerSignoff(input)`.

- [ ] **Step 1: Write failing API source-contract tests**

Assert candidate functions use authenticated ATLAS fetch + active org context and no exported candidate response type contains `answerKey`, `correctAnswer`, `expectedValue` or `instructorNotes`.

- [ ] **Step 2: Run API test to verify RED**

Run: `npx vitest run tests/integration/tax-academy-api.test.ts`
Expected: FAIL because API module does not exist.

- [ ] **Step 3: Implement candidate-safe API and instructor-specific calls**

Follow `taxApi.ts` response parsing/RPC conventions. Instructor/reviewer functions must call separate privileged RPCs, not a `includeAnswers=true` candidate endpoint.

- [ ] **Step 4: Add answer-key leakage regression test**

Inspect `taxAcademyApi.ts` candidate exports and assert forbidden key names are absent from candidate types/functions.

- [ ] **Step 5: Run API tests**

Run: `npx vitest run tests/integration/tax-academy-api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/taxAcademyApi.ts tests/integration/tax-academy-api.test.ts
git commit -m "feat(tax): add academy browser API"
```

### Task 5: Academy navigation, dashboard and practice library

**Files:**
- Create: `apps/web/src/modules/tax/academy/AcademyDashboard.tsx`
- Create: `apps/web/src/modules/tax/academy/PracticeLibrary.tsx`
- Create: `apps/web/src/modules/tax/academy/academy.css`
- Modify: `apps/web/src/modules/tax/TaxRoutes.tsx`
- Modify: `apps/web/src/modules/tax/TaxProfessionalDashboard.tsx`
- Test: `tests/integration/tax-academy-ui.test.ts`

**Interfaces:**
- Consumes: `ACADEMY_2026_CASES`, candidate summary API, existing Tax shell.
- Produces routes `/tax/academy` and `/tax/academy/practice`.

- [ ] **Step 1: Write failing UI contract tests**

Assert `TaxRoutes.tsx` contains an Academy navigation item and routes for dashboard/practice/exams/results/certification; dashboard copy includes `Practice & Exams`, current A-level and `training_current` warning when applicable.

- [ ] **Step 2: Run UI test to verify RED**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts`
Expected: FAIL because Academy components/routes are absent.

- [ ] **Step 3: Implement dashboard and practice library**

Dashboard must show: current level, next-level missing requirements, module progress, practical progress, specialties, recertification state and a prominent `Continue training` action. Practice library filters by level, module, filing status, specialty and completion state.

- [ ] **Step 4: Wire Tax routes and dashboard entry**

Add Academy to both detailed Tax nav and professional dashboard without removing current canonical routes.

- [ ] **Step 5: Run UI test and typecheck**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/tax/academy apps/web/src/modules/tax/TaxRoutes.tsx apps/web/src/modules/tax/TaxProfessionalDashboard.tsx tests/integration/tax-academy-ui.test.ts
git commit -m "feat(tax): add academy dashboard and practice library"
```

### Task 6: Practical Return Runner and Exam Runner with key isolation

**Files:**
- Create: `apps/web/src/modules/tax/academy/PracticalReturnRunner.tsx`
- Create: `apps/web/src/modules/tax/academy/ExamLibrary.tsx`
- Create: `apps/web/src/modules/tax/academy/ExamRunner.tsx`
- Modify: `apps/web/src/modules/tax/academy/academy.css`
- Modify: `apps/web/src/modules/tax/TaxRoutes.tsx`
- Test: `tests/integration/tax-academy-ui.test.ts`
- Test: `tests/integration/tax-academy-security.test.ts`

**Interfaces:**
- Consumes: candidate-safe case payloads, `startAcademyAttempt`, `submitAcademyAnswer`, `completeAcademyAttempt`.
- Produces routes `/tax/academy/practice/:caseId`, `/tax/academy/exams`, `/tax/academy/exams/:examId`.

- [ ] **Step 1: Write failing runner tests**

Assert practical runner renders, in order: filing status decision, source documents, missing-evidence checklist, form activation/ rejection, calculations/workpaper, diagnostics, due diligence, review/e-file readiness. Exam runner must not render explanations/correct answers before completion.

- [ ] **Step 2: Write failing security/source-bundle test for answer keys**

Read candidate-facing Academy component/API source and assert no import from an instructor answer-key module and no direct use of `answerKeyRef` for rendering/scoring in the browser.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement Practical Return Runner**

Use checkpoint persistence. Practice mode may request a post-checkpoint explanation only after server/domain evaluation; exam mode never receives explanations until the attempt is completed and policy allows review.

- [ ] **Step 5: Implement Exam Library/Runner**

Module exams, midterm, final written and practical exams must display attempt state, progress and critical-item policy without exposing answer keys.

- [ ] **Step 6: Run UI/security tests and typecheck**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/tax/academy apps/web/src/modules/tax/TaxRoutes.tsx tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts
git commit -m "feat(tax): add practical and exam runners"
```

### Task 7: Results, professional level assignment, badges and fail-closed production state

**Files:**
- Create: `apps/web/src/modules/tax/academy/ResultsDashboard.tsx`
- Create: `apps/web/src/modules/tax/academy/CertificationProfile.tsx`
- Modify: `apps/web/src/modules/tax/academy/academy.css`
- Modify: `apps/web/src/modules/tax/TaxRoutes.tsx`
- Test: `tests/integration/tax-academy-ui.test.ts`
- Test: `tests/integration/tax-academy-security.test.ts`

**Interfaces:**
- Consumes: `ProfessionalLevelDecision`, specialties and candidate summary API.
- Produces routes `/tax/academy/results` and `/tax/academy/certification`.

- [ ] **Step 1: Add failing results/certification tests**

Assert UI distinguishes `knowledge score`, `practical score`, `critical compliance`, `supervised returns`, `reviewer signoff`, `specialties` and `external credentials`. Assert no UI copy says an Academy level is an IRS credential.

- [ ] **Step 2: Add fail-closed tests for rule-pack status and overpromotion**

Assert:
- `training_current` shows `Training only — production certification unavailable`;
- a high written score without practical/reviewer evidence displays missing requirements and no production authorization;
- any critical failure displays failed/remediation state regardless of average.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement Results Dashboard and Certification Profile**

Show A0–A8 current/next level, transparent thresholds, permitted return classes, reviewer requirement, supervised-return progress, specialty badges and independently verified external credentials.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/tax/academy apps/web/src/modules/tax/TaxRoutes.tsx tests/integration/tax-academy-ui.test.ts tests/integration/tax-academy-security.test.ts
git commit -m "feat(tax): add academy results and certification levels"
```

### Task 8: Instructor review queue, Academy admin and privileged controls

**Files:**
- Create: `apps/web/src/modules/tax/academy/InstructorReviewQueue.tsx`
- Create: `apps/web/src/modules/tax/academy/AcademyAdmin.tsx`
- Modify: `apps/web/src/modules/tax/academy/academy.css`
- Modify: `apps/web/src/modules/tax/TaxRoutes.tsx`
- Test: `tests/integration/tax-academy-security.test.ts`

**Interfaces:**
- Consumes instructor-only API from Task 4.
- Produces route `/tax/academy/admin` and reviewer workflow for practical signoff/remediation.

- [ ] **Step 1: Write failing instructor authorization tests**

Assert admin/reviewer surfaces are identity/permission gated and cannot be reached merely by knowing the URL. Candidate code path must not call reviewer-signoff RPCs.

- [ ] **Step 2: Run security test to verify RED**

Run: `npx vitest run tests/integration/tax-academy-security.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Instructor Review Queue**

Reviewer sees candidate, case version, candidate answers/workpaper, computed score, critical failures, remediation history and evidence references; reviewer may approve, fail or request remediation with an audit note.

- [ ] **Step 4: Implement Academy Admin**

Admin can view rule-pack status, case versions, exam blueprints, level policy version and recertification status. Changes are display/governance surfaces only unless a separately authorized write RPC exists.

- [ ] **Step 5: Run security/UI tests and typecheck**

Run: `npx vitest run tests/integration/tax-academy-security.test.ts tests/integration/tax-academy-ui.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/tax/academy apps/web/src/modules/tax/TaxRoutes.tsx tests/integration/tax-academy-security.test.ts tests/integration/tax-academy-ui.test.ts
git commit -m "feat(tax): add academy instructor review controls"
```

### Task 9: Recertification, supervised-production evidence and annual roll-forward

**Files:**
- Modify: `packages/tax-academy/src/professionalLevels.ts`
- Modify: `packages/tax-academy/src/rulePackStatus.ts`
- Modify: `apps/web/src/modules/tax/academy/CertificationProfile.tsx`
- Test: `tests/unit/tax-academy-domain.test.ts`
- Test: `tests/integration/tax-academy-ui.test.ts`

**Interfaces:**
- Produces: `evaluateRecertification(input: RecertificationEvidence): RecertificationDecision`.
- Consumes: supervised-return/signoff persistence from Task 3.

- [ ] **Step 1: Write failing annual recertification tests**

Assert expired recertification sets `productionAuthorized=false`; new-year activation requires law-update completion, critical compliance pass, required CE state and applicable external PTIN/state credential verification fields.

- [ ] **Step 2: Write failing supervised-production tests**

Assert A3 requires first three supervised live returns without material preparer-negligence correction; A4 requires five A4-scope signoffs; A5 requires ten A4/A5-scope quality signoffs.

- [ ] **Step 3: Run domain tests to verify RED**

Run: `npx vitest run tests/unit/tax-academy-domain.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement recertification and supervised-return gates**

No Academy state may claim an IRS acceptance; supervised return evidence stores reviewer signoff references, not fabricated filing outcomes.

- [ ] **Step 5: Update Certification Profile to show recertification/roll-forward state**

Render next due date, tax-year rule-pack state and missing annual requirements.

- [ ] **Step 6: Run domain/UI tests and typecheck**

Run: `npx vitest run tests/unit/tax-academy-domain.test.ts tests/integration/tax-academy-ui.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/tax-academy/src apps/web/src/modules/tax/academy tests/unit/tax-academy-domain.test.ts tests/integration/tax-academy-ui.test.ts
git commit -m "feat(tax): enforce academy recertification gates"
```

### Task 10: Whole-feature verification, production-safe messaging and documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-atlas-tax-academy-certification.md` only if implementation evidence requires clarification; do not rewrite approved requirements.
- Create: `docs/tax/academy-operations.md`
- Test: all Academy tests + existing repository gates.

**Interfaces:**
- Consumes all prior tasks.
- Produces operator guidance for annual IRS final-form refresh and evidence required to move a tax-year pack from `training_current` to `production_certified`.

- [ ] **Step 1: Write Academy operations runbook**

Document: role boundaries, answer-key isolation, annual rule-pack promotion evidence, reviewer workflow, remediation, recertification, external credential verification and no-claim rules for filing/acceptance.

- [ ] **Step 2: Run focused Academy test suite**

Run:
```bash
npx vitest run \
  tests/unit/tax-academy-domain.test.ts \
  tests/unit/tax-academy-content.test.ts \
  tests/integration/tax-academy-schema.test.ts \
  tests/integration/tax-academy-api.test.ts \
  tests/integration/tax-academy-ui.test.ts \
  tests/integration/tax-academy-security.test.ts
```
Expected: all PASS.

- [ ] **Step 3: Run repository typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS; deployment manifest generated by existing build script.

- [ ] **Step 4: Run existing unit/integration regression suites**

Run: `npm run test:unit && npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Run applicable repository verification gate**

Run: `npm run verify:cloudflare`
Expected: PASS. Do not claim deployment or production verification from this local gate alone.

- [ ] **Step 6: Inspect diff for answer-key leakage and production-state wording**

Run:
```bash
git diff --check
git grep -n "answerKey\|correctAnswer\|production_certified\|accepted\|filed" -- apps/web/src/modules/tax/academy apps/web/src/lib/taxAcademyApi.ts packages/tax-academy/src
```
Expected: no candidate-facing answer-key exposure; production/filed/accepted language only appears in truthful gated contexts.

- [ ] **Step 7: Commit verification/runbook changes**

```bash
git add docs/tax/academy-operations.md
git commit -m "docs(tax): add academy operations and annual refresh runbook"
```

- [ ] **Step 8: Create PR only after all local evidence is green**

PR title: `feat(tax): add governed Tax Academy certification`

PR body must list:
- spec and plan paths;
- A0–A8 policy;
- H&R Block benchmark boundary;
- test commands/results;
- migration/RLS evidence;
- answer-key isolation evidence;
- 2026 `training_current` production gate;
- screenshots/E2E evidence if available.

- [ ] **Step 9: Verify CI before merge**

Do not merge while required checks are pending or failing. Inspect failing job logs and repair on the feature branch.

- [ ] **Step 10: Merge/deploy/E2E only with explicit evidence**

After merge, verify the canonical deployment workflow and production route `/tax/academy`. E2E must demonstrate: authenticated Academy dashboard, candidate cannot access admin/key data, a practice attempt persists, a completed exam produces a score, a critical-failure scenario fails despite passing average, and `training_current` content remains production-blocked. Do not mark production complete without deployment and E2E evidence.

---

## Self-Review Results

- **Spec coverage:** All spec sections are assigned: levels/scoring (Tasks 1/7/9), specialties/external credentials (1/7), exam/practical architecture (2/6), persistence/RLS (3), API (4), UI/navigation (5–8), annual recertification (9), integration/verification (10).
- **Step scan:** Each task carries a RED → implementation → GREEN → commit cycle; no task depends on an undefined public interface.
- **Type consistency:** `ProfessionalLevelDecision`, `AcademyRulePackStatus`, candidate-safe attempt APIs and instructor-only APIs are defined once and consumed by later tasks.
- **Review Focus:** The five high-risk conditions are pinned to Tasks 1–8 with explicit tests.
- **Proportion:** Implementation details are limited to interfaces, assertions and exact gates; component/function bodies remain implementation work.